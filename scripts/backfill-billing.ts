/**
 * Backfill billing columns for all clock_records.
 * Run with: npx tsx scripts/backfill-billing.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// === Billing calculation (replicated from src/lib/utils.ts) ===

const NURSE_SALARY_RATIO = 0.9;
const TAIPEI_OFFSET = 8 * 60 * 60 * 1000; // UTC+8

interface RateRow {
  main_day_rate: number;
  main_night_rate: number;
  other_day_rate: number;
  other_night_rate: number;
  remote_area_subsidy: number;
}

interface SpecialRow {
  start_time: string | null;
  end_time: string | null;
  multiplier: number;
}

function getRatesForCase(rate: RateRow, caseType: string) {
  if (caseType === '其它地區') {
    return { dayRate: Number(rate.other_day_rate), nightRate: Number(rate.other_night_rate) };
  }
  return { dayRate: Number(rate.main_day_rate), nightRate: Number(rate.main_night_rate) };
}

/** Calculate day/night minutes using Taiwan timezone */
function calcDayNightMinutes(clockIn: string, clockOut: string) {
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  let dayMin = 0, nightMin = 0;
  let cursor = start;

  while (cursor < end) {
    const taipeiDate = new Date(cursor + TAIPEI_OFFSET);
    const h = taipeiDate.getUTCHours();
    const m = taipeiDate.getUTCMinutes();
    const currentMinOfDay = h * 60 + m;

    let isDayShift = currentMinOfDay >= 480 && currentMinOfDay < 1200; // 08:00~20:00
    let nextBoundary: number;

    if (currentMinOfDay < 480) {
      nextBoundary = cursor + (480 - currentMinOfDay) * 60000;
    } else if (currentMinOfDay < 1200) {
      nextBoundary = cursor + (1200 - currentMinOfDay) * 60000;
    } else {
      nextBoundary = cursor + (1440 - currentMinOfDay + 480) * 60000;
    }

    const segmentEnd = Math.min(nextBoundary, end);
    const segmentMin = (segmentEnd - cursor) / 60000;

    if (isDayShift) dayMin += segmentMin;
    else nightMin += segmentMin;

    cursor = segmentEnd;
  }
  return { dayMin, nightMin };
}

function getDayNightHours(clockIn: string, clockOut: string) {
  const { dayMin, nightMin } = calcDayNightMinutes(clockIn, clockOut);
  return {
    dayHours: Math.floor(dayMin / 30) * 0.5,
    nightHours: Math.floor(nightMin / 30) * 0.5,
  };
}

function getSpecialMultiplier(clockIn: string, clockOut: string, specialConditions: SpecialRow[]): number {
  if (specialConditions.length === 0) return 1;
  const shiftStart = new Date(clockIn).getTime();
  const shiftEnd = new Date(clockOut).getTime();
  let maxMultiplier = 1;
  for (const sc of specialConditions) {
    if (!sc.start_time || !sc.end_time) continue;
    const scStart = new Date(sc.start_time).getTime();
    const scEnd = new Date(sc.end_time).getTime();
    if (shiftStart < scEnd && shiftEnd > scStart) {
      maxMultiplier = Math.max(maxMultiplier, Number(sc.multiplier));
    }
  }
  return maxMultiplier;
}

function calculateBilling(
  clockIn: string, clockOut: string, salary: number,
  rate: RateRow, caseType: string, remoteSubsidy: boolean,
  specialConditions: SpecialRow[],
) {
  const { dayRate, nightRate } = getRatesForCase(rate, caseType);
  const { dayMin, nightMin } = calcDayNightMinutes(clockIn, clockOut);
  const dayHours = Math.floor(dayMin / 30) * 0.5;
  const nightHours = Math.floor(nightMin / 30) * 0.5;
  const multiplier = getSpecialMultiplier(clockIn, clockOut, specialConditions);

  let billing = Math.round((dayHours * dayRate + nightHours * nightRate) * multiplier);

  if (remoteSubsidy) {
    billing += Number(rate.remote_area_subsidy) || 500;
  }

  // Manual salary override
  if (salary > 0) {
    billing = salary;
  }

  const nurseSalary = Math.round(billing * NURSE_SALARY_RATIO);
  const hours = getDayNightHours(clockIn, clockOut);

  return { billing, nurseSalary, dayHours: hours.dayHours, nightHours: hours.nightHours };
}

// === Main ===

async function main() {
  console.log('Starting backfill...');

  // Get all orgs
  const { data: orgs } = await supabase.from('organizations').select('id').limit(10);
  if (!orgs?.length) { console.error('No organizations found'); return; }

  for (const org of orgs) {
    console.log(`\nOrg: ${org.id}`);

    // Load latest rate settings
    const { data: rates } = await supabase
      .from('rate_settings')
      .select('main_day_rate, main_night_rate, other_day_rate, other_night_rate, remote_area_subsidy')
      .eq('org_id', org.id)
      .order('effective_date', { ascending: false })
      .limit(1);

    const rate = rates?.[0];
    if (!rate) { console.log('  No rate settings, skip'); continue; }
    console.log(`  Rate: mainDay=${rate.main_day_rate}, mainNight=${rate.main_night_rate}, otherDay=${rate.other_day_rate}, otherNight=${rate.other_night_rate}`);

    // Load special conditions
    const { data: scs } = await supabase
      .from('special_conditions')
      .select('start_time, end_time, multiplier')
      .eq('org_id', org.id);
    const specialConditions: SpecialRow[] = scs || [];
    console.log(`  Special conditions: ${specialConditions.length}`);

    // Load cases
    const { data: cases } = await supabase
      .from('cases')
      .select('id, case_type, remote_subsidy')
      .eq('org_id', org.id);
    const caseMap = new Map<string, { caseType: string; remoteSubsidy: boolean }>();
    for (const c of (cases || [])) {
      caseMap.set(c.id, { caseType: c.case_type || '主要地區', remoteSubsidy: !!c.remote_subsidy });
    }
    console.log(`  Cases: ${caseMap.size}`);

    // Process records in batches
    const PAGE = 1000;
    let totalUpdated = 0;
    let batchNum = 0;

    while (true) {
      // Always fetch from offset 0 since we filter billing=0 and update removes them from the set
      const { data: records, error } = await supabase
        .from('clock_records')
        .select('id, clock_in_time, clock_out_time, salary, case_id')
        .eq('org_id', org.id)
        .not('clock_out_time', 'is', null)
        .eq('billing', 0)
        .order('clock_in_time', { ascending: true })
        .range(0, PAGE - 1);

      if (error) { console.error('  Fetch error:', error.message); break; }
      if (!records || records.length === 0) break;

      batchNum++;
      const startTime = Date.now();

      // Process with concurrency limit of 20
      const CONCURRENCY = 20;
      const updateOne = async (r: typeof records[0]) => {
        const caseInfo = caseMap.get(r.case_id) || { caseType: '主要地區', remoteSubsidy: false };
        const result = calculateBilling(
          r.clock_in_time, r.clock_out_time, Number(r.salary),
          rate, caseInfo.caseType, caseInfo.remoteSubsidy,
          specialConditions,
        );
        await supabase
          .from('clock_records')
          .update({
            billing: result.billing,
            nurse_salary: result.nurseSalary,
            day_hours: result.dayHours,
            night_hours: result.nightHours,
          })
          .eq('id', r.id);
      };

      for (let i = 0; i < records.length; i += CONCURRENCY) {
        const chunk = records.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(updateOne));
      }

      totalUpdated += records.length;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Batch ${batchNum}: ${records.length} records in ${elapsed}s (total: ${totalUpdated})`);

      if (records.length < PAGE) break;
    }

    console.log(`  Done: ${totalUpdated} records updated`);
  }

  console.log('\nBackfill complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
