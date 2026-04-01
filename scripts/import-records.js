#!/usr/bin/env node
/**
 * Import clock records from Excel files into Supabase
 *
 * Steps:
 * 1. Delete existing clock records (except test/admin accounts)
 * 2. Scan all xlsx files to extract cases, nurses, and records
 * 3. Create new cases in DB
 * 4. Insert clock records, matching nurses by name
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ORG_ID = process.env.ORG_ID || '00000000-0000-0000-0000-000000000001';

const BASE_DIR = path.resolve('D:/GA/0310Nursing/打卡紀錄/打卡紀錄');

// ROC year to AD year
const ROC_YEAR_MAP = { '113年': 2024, '114年': 2025, '115年': 2026 };

async function supaFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.method === 'POST' ? 'return=representation' : 'return=minimal',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('json')) {
    return res.json();
  }
  return null;
}

// Get all existing users (nurses)
async function getUsers() {
  return supaFetch('users?select=id,name,account,role&order=name');
}

// Get all existing cases
async function getCases() {
  return supaFetch('cases?select=id,name,code&order=name');
}

// Delete non-test/admin clock records
async function deleteNonTestRecords(testUserIds) {
  // Get all records
  const records = await supaFetch('clock_records?select=id,user_id');
  const toDelete = records.filter(r => !testUserIds.has(r.user_id));
  console.log(`Found ${records.length} total records, ${toDelete.length} to delete (keeping ${records.length - toDelete.length} test/admin)`);

  // Delete in batches
  const batchSize = 100;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const ids = batch.map(r => r.id);
    await supaFetch(`clock_records?id=in.(${ids.join(',')})`, { method: 'DELETE' });
    process.stdout.write(`\rDeleted ${Math.min(i + batchSize, toDelete.length)}/${toDelete.length}`);
  }
  console.log('\nDeletion complete');
}

// Parse time range like "0800-2000" or "2000-0800"
function parseTimeRange(timeStr) {
  const match = timeStr.match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  const inHH = parseInt(match[1].slice(0, 2));
  const inMM = parseInt(match[1].slice(2, 4));
  const outHH = parseInt(match[2].slice(0, 2));
  const outMM = parseInt(match[2].slice(2, 4));
  return { inHH, inMM, outHH, outMM };
}

// Build ISO datetime string
function buildDateTime(year, month, day, hh, mm) {
  const d = new Date(year, month - 1, day, hh, mm, 0);
  return d.toISOString();
}

// Parse week folder name to get reference date (e.g. "打卡紀錄0111~0117" → {month:1, day:11})
function parseFolderRefDate(folderName, adYear) {
  const match = folderName.match(/(\d{2})(\d{2})~/);
  if (!match) return new Date(adYear, 0, 1); // fallback to Jan 1
  const refMonth = parseInt(match[1]);
  const refDay = parseInt(match[2]);
  return new Date(adYear, refMonth - 1, refDay);
}

// Determine the correct year for a record's month/day based on folder context
function resolveYear(month, day, adYear, folderRefDate) {
  const today = new Date();
  const candidates = [
    new Date(adYear - 1, month - 1, day),
    new Date(adYear, month - 1, day),
    new Date(adYear + 1, month - 1, day),
  ];
  // Pick the candidate closest to folderRefDate that is not in the future
  let best = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c > today) continue; // skip future dates
    const dist = Math.abs(c.getTime() - folderRefDate.getTime());
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best ? best.getFullYear() : adYear;
}

// Scan all xlsx files and extract data
function scanExcelFiles() {
  const allCases = new Map(); // code → name
  const allRecords = []; // { caseCode, nurseName, clockIn, clockOut, salary }
  let fileCount = 0;
  let errorCount = 0;

  for (const yearFolder of Object.keys(ROC_YEAR_MAP)) {
    const yearPath = path.join(BASE_DIR, yearFolder);
    if (!fs.existsSync(yearPath)) continue;
    const adYear = ROC_YEAR_MAP[yearFolder];

    const weekFolders = fs.readdirSync(yearPath).filter(f => f.startsWith('打卡紀錄'));

    for (const weekFolder of weekFolders) {
      const weekPath = path.join(yearPath, weekFolder);
      if (!fs.statSync(weekPath).isDirectory()) continue;

      const folderRefDate = parseFolderRefDate(weekFolder, adYear);
      const files = fs.readdirSync(weekPath).filter(f => f.endsWith('.xlsx'));

      for (const file of files) {
        fileCount++;
        if (fileCount % 100 === 0) process.stdout.write(`\rScanning file ${fileCount}...`);

        try {
          // Extract case name and code from filename
          const baseName = file.replace('.xlsx', '');
          const lastUnderscore = baseName.lastIndexOf('_');
          if (lastUnderscore === -1) continue;

          const caseName = baseName.substring(0, lastUnderscore);
          const caseCode = baseName.substring(lastUnderscore + 1);

          if (!allCases.has(caseCode)) {
            allCases.set(caseCode, caseName);
          }

          // Read Excel
          const wb = XLSX.readFile(path.join(weekPath, file));
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

          let currentDate = null; // {month, day}

          for (let i = 1; i < rows.length; i++) { // Skip header
            const row = rows[i];
            if (!row || row.length < 3) continue;

            const [dateStr, timeStr, nurseName, salary] = row;

            // Parse date
            if (dateStr) {
              const dateMatch = String(dateStr).match(/(\d{1,2})\/(\d{1,2})/);
              if (dateMatch) {
                currentDate = { month: parseInt(dateMatch[1]), day: parseInt(dateMatch[2]) };
              }
            }

            if (!currentDate || !timeStr || !nurseName) continue;
            if (String(nurseName) === '總和' || String(nurseName) === '') continue;

            const timeRange = parseTimeRange(String(timeStr).trim());
            if (!timeRange) continue;

            // Determine year using folder reference date to handle year boundaries
            const year = resolveYear(currentDate.month, currentDate.day, adYear, folderRefDate);

            const clockInTime = buildDateTime(year, currentDate.month, currentDate.day, timeRange.inHH, timeRange.inMM);

            // Clock out time
            let clockOutTime;
            if (timeRange.outHH < timeRange.inHH || (timeRange.outHH === timeRange.inHH && timeRange.outMM < timeRange.inMM)) {
              // Night shift: clock out is next day
              clockOutTime = buildDateTime(year, currentDate.month, currentDate.day + 1, timeRange.outHH, timeRange.outMM);
            } else {
              clockOutTime = buildDateTime(year, currentDate.month, currentDate.day, timeRange.outHH, timeRange.outMM);
            }

            allRecords.push({
              caseCode,
              nurseName: String(nurseName).trim(),
              clockInTime,
              clockOutTime,
              salary: typeof salary === 'number' ? salary : 0,
            });
          }
        } catch (err) {
          errorCount++;
          if (errorCount <= 5) console.error(`\nError reading ${file}: ${err.message}`);
        }
      }
    }
  }

  // Also scan "其他個案" folder if it exists
  for (const yearFolder of Object.keys(ROC_YEAR_MAP)) {
    const otherPath = path.join(BASE_DIR, yearFolder, '其他個案');
    if (fs.existsSync(otherPath) && fs.statSync(otherPath).isDirectory()) {
      const files = fs.readdirSync(otherPath).filter(f => f.endsWith('.xlsx'));
      for (const file of files) {
        fileCount++;
        try {
          const baseName = file.replace('.xlsx', '');
          const lastUnderscore = baseName.lastIndexOf('_');
          if (lastUnderscore === -1) continue;
          const caseName = baseName.substring(0, lastUnderscore);
          const caseCode = baseName.substring(lastUnderscore + 1);
          if (!allCases.has(caseCode)) {
            allCases.set(caseCode, caseName);
          }
          // Could parse records too, but skip for now
        } catch {}
      }
    }
  }

  console.log(`\nScanned ${fileCount} files (${errorCount} errors)`);
  console.log(`Found ${allCases.size} unique cases, ${allRecords.length} records`);

  // Count unique nurses
  const nurseNames = new Set(allRecords.map(r => r.nurseName));
  console.log(`Found ${nurseNames.size} unique nurse names`);

  return { allCases, allRecords, nurseNames };
}

async function main() {
  console.log('=== Import Clock Records ===\n');

  // Step 0: Get existing data
  console.log('Fetching existing data...');
  const existingUsers = await getUsers();
  const existingCases = await getCases();

  // Build name→id maps
  const userByName = new Map(existingUsers.map(u => [u.name, u.id]));
  const caseByCode = new Map(existingCases.map(c => [c.code, c.id]));

  // Test/admin user IDs to keep
  const testAccounts = new Set(['T123', 'A123']);
  const testUserIds = new Set(existingUsers.filter(u => testAccounts.has(u.account)).map(u => u.id));

  console.log(`Existing: ${existingUsers.length} users, ${existingCases.length} cases`);
  console.log(`Test/admin users to keep: ${testUserIds.size}`);

  // Step 1: Delete non-test records
  console.log('\nStep 1: Deleting non-test clock records...');
  await deleteNonTestRecords(testUserIds);

  // Step 2: Scan Excel files
  console.log('\nStep 2: Scanning Excel files...');
  const { allCases, allRecords, nurseNames } = scanExcelFiles();

  // Step 3: Create missing cases
  console.log('\nStep 3: Creating missing cases...');
  let newCaseCount = 0;
  for (const [code, name] of allCases) {
    if (!caseByCode.has(code)) {
      try {
        const result = await supaFetch('cases', {
          method: 'POST',
          body: JSON.stringify({
            org_id: ORG_ID,
            name,
            code,
            case_type: '主要地區',
            settlement_type: '週',
            remote_subsidy: false,
          }),
        });
        if (result && result[0]) {
          caseByCode.set(code, result[0].id);
          newCaseCount++;
        }
      } catch (err) {
        console.error(`Failed to create case ${name} (${code}): ${err.message}`);
      }
    }
  }
  console.log(`Created ${newCaseCount} new cases (total: ${caseByCode.size})`);

  // Step 4: Check unmatched nurses
  const unmatchedNurses = [];
  for (const name of nurseNames) {
    if (!userByName.has(name)) {
      unmatchedNurses.push(name);
    }
  }
  console.log(`\nUnmatched nurses: ${unmatchedNurses.length} / ${nurseNames.size}`);
  if (unmatchedNurses.length > 0 && unmatchedNurses.length <= 20) {
    console.log('Unmatched:', unmatchedNurses.join(', '));
  }

  // Step 5: Insert clock records
  console.log('\nStep 5: Inserting clock records...');
  let insertedCount = 0;
  let skippedCount = 0;
  const batch = [];
  const batchSize = 200;

  for (const record of allRecords) {
    const userId = userByName.get(record.nurseName);
    const caseId = caseByCode.get(record.caseCode);

    if (!userId || !caseId) {
      skippedCount++;
      continue;
    }

    batch.push({
      org_id: ORG_ID,
      user_id: userId,
      case_id: caseId,
      clock_in_time: record.clockInTime,
      clock_out_time: record.clockOutTime,
      salary: record.salary,
      clock_in_lat: null,
      clock_in_lng: null,
      clock_out_lat: null,
      clock_out_lng: null,
      paid_at: null,
    });

    if (batch.length >= batchSize) {
      try {
        await supaFetch('clock_records', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(batch),
        });
        insertedCount += batch.length;
        process.stdout.write(`\rInserted ${insertedCount} records...`);
      } catch (err) {
        console.error(`\nBatch insert error: ${err.message}`);
      }
      batch.length = 0;
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    try {
      await supaFetch('clock_records', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(batch),
      });
      insertedCount += batch.length;
    } catch (err) {
      console.error(`\nFinal batch insert error: ${err.message}`);
    }
  }

  console.log(`\n\n=== Import Complete ===`);
  console.log(`Inserted: ${insertedCount} records`);
  console.log(`Skipped: ${skippedCount} records (nurse not found or case not found)`);
  console.log(`New cases created: ${newCaseCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
