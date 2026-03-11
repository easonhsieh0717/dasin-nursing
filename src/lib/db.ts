import { supabase, isSupabase } from './supabase';
import fs from 'fs';
import path from 'path';

const isVercel = !!process.env.VERCEL;
const DB_PATH = isVercel
  ? path.join('/tmp', 'data', 'db.json')
  : path.join(process.cwd(), 'data', 'db.json');

// ===== Types =====
export interface Organization { id: string; code: string; name: string; }
export interface User { id: string; orgId: string; name: string; account: string; password: string; role: 'admin' | 'employee'; hourlyRate: number; bank?: string; accountNo?: string; accountName?: string; defaultCaseId?: string; }
export interface Case { id: string; orgId: string; name: string; code: string; caseType: string; settlementType: string; }
export interface ClockRecord { id: string; orgId: string; userId: string; caseId: string; clockInTime: string | null; clockInLat: number | null; clockInLng: number | null; clockOutTime: string | null; clockOutLat: number | null; clockOutLng: number | null; salary: number; }
export interface SpecialCondition { id: string; orgId: string; name: string; target: string; multiplier: number; startTime: string; endTime: string; }
export interface RateSettings { id: string; orgId: string; effectiveDate: string; label: string; mainDayRate: number; mainNightRate: number; otherDayRate: number; otherNightRate: number; fullDayRate24h: number; minBillingHours: number; remoteAreaSubsidy: number; dialysisVisitFee: number; dialysisOvertimeRate: number; }
export interface ModificationRequest { id: string; orgId: string; recordId: string; userId: string; originalClockInTime: string | null; originalClockOutTime: string | null; proposedClockInTime: string | null; proposedClockOutTime: string | null; reason: string; status: 'pending' | 'approved' | 'rejected'; reviewedBy: string | null; reviewedAt: string | null; createdAt: string; }

// ===== Supabase row mappers =====
/* eslint-disable @typescript-eslint/no-explicit-any */
function toUser(r: any): User { return { id: r.id, orgId: r.org_id, name: r.name, account: r.account, password: r.password, role: r.role, hourlyRate: Number(r.hourly_rate), bank: r.bank || '', accountNo: r.account_no || '', accountName: r.account_name || '', defaultCaseId: r.default_case_id || undefined }; }
function toCase(r: any): Case { return { id: r.id, orgId: r.org_id, name: r.name, code: r.code, caseType: r.case_type, settlementType: r.settlement_type }; }
function toRecord(r: any): ClockRecord { return { id: r.id, orgId: r.org_id, userId: r.user_id, caseId: r.case_id, clockInTime: r.clock_in_time, clockInLat: r.clock_in_lat, clockInLng: r.clock_in_lng, clockOutTime: r.clock_out_time, clockOutLat: r.clock_out_lat, clockOutLng: r.clock_out_lng, salary: Number(r.salary) }; }
function toSC(r: any): SpecialCondition { return { id: r.id, orgId: r.org_id, name: r.name, target: r.target, multiplier: Number(r.multiplier), startTime: r.start_time, endTime: r.end_time }; }
function toRS(r: any): RateSettings { return { id: r.id, orgId: r.org_id, effectiveDate: r.effective_date, label: r.label, mainDayRate: Number(r.main_day_rate), mainNightRate: Number(r.main_night_rate), otherDayRate: Number(r.other_day_rate), otherNightRate: Number(r.other_night_rate), fullDayRate24h: Number(r.full_day_rate_24h), minBillingHours: Number(r.min_billing_hours), remoteAreaSubsidy: Number(r.remote_area_subsidy), dialysisVisitFee: Number(r.dialysis_visit_fee), dialysisOvertimeRate: Number(r.dialysis_overtime_rate) }; }
function toModReq(r: any): ModificationRequest { return { id: r.id, orgId: r.org_id, recordId: r.record_id, userId: r.user_id, originalClockInTime: r.original_clock_in_time, originalClockOutTime: r.original_clock_out_time, proposedClockInTime: r.proposed_clock_in_time, proposedClockOutTime: r.proposed_clock_out_time, reason: r.reason, status: r.status, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, createdAt: r.created_at }; }
/* eslint-enable @typescript-eslint/no-explicit-any */

// ===== Local JSON fallback =====
interface DB { organizations: Organization[]; users: User[]; cases: Case[]; clockRecords: ClockRecord[]; specialConditions: SpecialCondition[]; rateSettings: RateSettings[]; modificationRequests: ModificationRequest[]; }

function generateId(): string { return Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }

// In-memory cache for Vercel serverless (no persistent filesystem)
let memoryDB: DB | null = null;

function getInitialData(): DB {
  return {
    organizations: [{ id: 'org1', code: 'ZSB', name: '達信護理' }],
    users: [
      { id: 'admin1', orgId: 'org1', name: '管理員', account: 'A123', password: '9123', role: 'admin', hourlyRate: 0 },
      { id: 'emp1', orgId: 'org1', name: '特護測試', account: 'L123', password: '9123', role: 'employee', hourlyRate: 200 },
      { id: 'emp2', orgId: 'org1', name: '郭語', account: 'G001', password: '1234', role: 'employee', hourlyRate: 200 },
      { id: 'emp3', orgId: 'org1', name: '陳俞均', account: 'C001', password: '1234', role: 'employee', hourlyRate: 220 },
    ],
    cases: [
      { id: 'case1', orgId: 'org1', name: '中山區寶寶', code: 'ZSBB', caseType: '一般', settlementType: '週' },
      { id: 'case2', orgId: 'org1', name: '高樹梁伯伯', code: 'GSLBB', caseType: '一般', settlementType: '月' },
      { id: 'case3', orgId: 'org1', name: '林口錢林奶奶', code: 'LKQLN', caseType: '一般', settlementType: '週' },
      { id: 'case4', orgId: 'org1', name: '天母居家奶奶', code: 'TMJJN', caseType: '一般', settlementType: '月' },
    ],
    clockRecords: [
      { id: 'rec1', orgId: 'org1', userId: 'emp1', caseId: 'case1', clockInTime: '2026-03-06T23:50:00', clockInLat: 25.0503, clockInLng: 121.5295, clockOutTime: '2026-03-07T08:16:00', clockOutLat: 25.0506, clockOutLng: 121.5286, salary: 0 },
      { id: 'rec2', orgId: 'org1', userId: 'emp2', caseId: 'case1', clockInTime: '2026-03-07T11:00:00', clockInLat: 25.0508, clockInLng: 121.5286, clockOutTime: '2026-03-07T19:07:00', clockOutLat: null, clockOutLng: null, salary: 0 },
    ],
    specialConditions: [{ id: 'sc1', orgId: 'org1', name: '過年', target: 'ZSB', multiplier: 2, startTime: '2026-02-16T16:30:00', endTime: '2026-02-21T23:59:00' }],
    rateSettings: [{ id: 'rate1', orgId: 'org1', effectiveDate: '2024-12-01', label: '113/12/1 生效費率', mainDayRate: 490, mainNightRate: 530, otherDayRate: 550, otherNightRate: 600, fullDayRate24h: 12240, minBillingHours: 8, remoteAreaSubsidy: 500, dialysisVisitFee: 3000, dialysisOvertimeRate: 500 }],
    modificationRequests: [],
  };
}

function readDB(): DB {
  if (memoryDB) return memoryDB;
  // Try reading from file
  try {
    if (fs.existsSync(DB_PATH)) {
      memoryDB = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      return memoryDB!;
    }
  } catch { /* ignore fs errors on Vercel */ }
  // Fallback to initial seed data
  memoryDB = getInitialData();
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(memoryDB, null, 2), 'utf-8');
  } catch { /* Vercel read-only filesystem - data lives in memory */ }
  return memoryDB;
}

function writeDB(db: DB) {
  memoryDB = db;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch { /* Vercel read-only filesystem - data lives in memory only */ }
}

// ===== Organizations =====
export async function getOrgByCode(code: string): Promise<Organization | undefined> {
  if (isSupabase) {
    const { data } = await supabase.from('organizations').select('*').eq('code', code).single();
    return data ? { id: data.id, code: data.code, name: data.name } : undefined;
  }
  return readDB().organizations.find(o => o.code === code);
}

// ===== Users =====
// 管理員不需要代碼即可登入
export async function authenticateAdmin(account: string, password: string): Promise<{ user: User; org: Organization } | null> {
  if (isSupabase) {
    const { data } = await supabase.from('users').select('*').eq('account', account).eq('password', password).eq('role', 'admin').single();
    if (!data) return null;
    const user = toUser(data);
    const { data: orgData } = await supabase.from('organizations').select('*').eq('id', user.orgId).single();
    if (!orgData) return null;
    return { user, org: { id: orgData.id, code: orgData.code, name: orgData.name } };
  }
  const db = readDB();
  const user = db.users.find(u => u.account === account && u.password === password && u.role === 'admin');
  if (!user) return null;
  const org = db.organizations.find(o => o.id === user.orgId);
  if (!org) return null;
  return { user, org };
}

export async function authenticateUser(orgCode: string, account: string, password: string): Promise<User | null> {
  if (isSupabase) {
    const { data: org } = await supabase.from('organizations').select('id').eq('code', orgCode).single();
    if (!org) return null;
    const { data } = await supabase.from('users').select('*').eq('org_id', org.id).eq('account', account).eq('password', password).single();
    return data ? toUser(data) : null;
  }
  const db = readDB();
  const org = db.organizations.find(o => o.code === orgCode);
  if (!org) return null;
  return db.users.find(u => u.orgId === org.id && u.account === account && u.password === password) || null;
}

export async function getUserById(id: string): Promise<User | null> {
  if (isSupabase) {
    const { data } = await supabase.from('users').select('*').eq('id', id).single();
    return data ? toUser(data) : null;
  }
  const user = readDB().users.find(u => u.id === id);
  return user || null;
}

export async function getUsers(orgId: string, search?: string, page?: number, pageSize?: number): Promise<{ users: User[]; total: number }> {
  if (isSupabase) {
    let q = supabase.from('users').select('*', { count: 'exact' }).eq('org_id', orgId).eq('role', 'employee');
    if (search) q = q.ilike('name', `%${search}%`);
    q = q.order('name');
    if (page && pageSize) {
      const from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);
    }
    const { data, count } = await q;
    return { users: (data || []).map(toUser), total: count || 0 };
  }
  let users = readDB().users.filter(u => u.orgId === orgId && u.role === 'employee');
  if (search) users = users.filter(u => u.name.includes(search));
  const total = users.length;
  if (page && pageSize) {
    const start = (page - 1) * pageSize;
    users = users.slice(start, start + pageSize);
  }
  return { users, total };
}

export async function createUser(user: Omit<User, 'id'>): Promise<User> {
  if (isSupabase) {
    const insert: Record<string, unknown> = { org_id: user.orgId, name: user.name, account: user.account, password: user.password, role: user.role, hourly_rate: user.hourlyRate, bank: user.bank || '', account_no: user.accountNo || '', account_name: user.accountName || '' };
    if (user.defaultCaseId) insert.default_case_id = user.defaultCaseId;
    const { data } = await supabase.from('users').insert(insert).select().single();
    return toUser(data);
  }
  const db = readDB(); const n: User = { ...user, id: generateId() }; db.users.push(n); writeDB(db); return n;
}

export async function updateUser(id: string, data: Partial<User>): Promise<User | null> {
  if (isSupabase) {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.account !== undefined) update.account = data.account;
    if (data.password !== undefined) update.password = data.password;
    if (data.hourlyRate !== undefined) update.hourly_rate = data.hourlyRate;
    if (data.bank !== undefined) update.bank = data.bank;
    if (data.accountNo !== undefined) update.account_no = data.accountNo;
    if (data.accountName !== undefined) update.account_name = data.accountName;
    if (data.defaultCaseId !== undefined) update.default_case_id = data.defaultCaseId || null;
    const { data: row } = await supabase.from('users').update(update).eq('id', id).select().single();
    return row ? toUser(row) : null;
  }
  const db = readDB(); const idx = db.users.findIndex(u => u.id === id); if (idx === -1) return null; db.users[idx] = { ...db.users[idx], ...data }; writeDB(db); return db.users[idx];
}

export async function deleteUser(id: string): Promise<boolean> {
  if (isSupabase) { await supabase.from('users').delete().eq('id', id); return true; }
  const db = readDB(); const idx = db.users.findIndex(u => u.id === id); if (idx === -1) return false; db.users.splice(idx, 1); writeDB(db); return true;
}

// ===== Cases =====
export async function getCases(orgId: string, search?: string): Promise<Case[]> {
  if (isSupabase) {
    let q = supabase.from('cases').select('*').eq('org_id', orgId);
    if (search) q = q.ilike('name', `%${search}%`);
    const { data } = await q;
    return (data || []).map(toCase);
  }
  let cases = readDB().cases.filter(c => c.orgId === orgId);
  if (search) cases = cases.filter(c => c.name.includes(search));
  return cases;
}

export async function createCase(c: Omit<Case, 'id'>): Promise<Case> {
  if (isSupabase) {
    const { data } = await supabase.from('cases').insert({ org_id: c.orgId, name: c.name, code: c.code, case_type: c.caseType, settlement_type: c.settlementType }).select().single();
    return toCase(data);
  }
  const db = readDB(); const n: Case = { ...c, id: generateId() }; db.cases.push(n); writeDB(db); return n;
}

export async function updateCase(id: string, data: Partial<Case>): Promise<Case | null> {
  if (isSupabase) {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.code !== undefined) update.code = data.code;
    if (data.caseType !== undefined) update.case_type = data.caseType;
    if (data.settlementType !== undefined) update.settlement_type = data.settlementType;
    const { data: row } = await supabase.from('cases').update(update).eq('id', id).select().single();
    return row ? toCase(row) : null;
  }
  const db = readDB(); const idx = db.cases.findIndex(c => c.id === id); if (idx === -1) return null; db.cases[idx] = { ...db.cases[idx], ...data }; writeDB(db); return db.cases[idx];
}

export async function deleteCase(id: string): Promise<boolean> {
  if (isSupabase) { await supabase.from('cases').delete().eq('id', id); return true; }
  const db = readDB(); const idx = db.cases.findIndex(c => c.id === id); if (idx === -1) return false; db.cases.splice(idx, 1); writeDB(db); return true;
}

// ===== Clock Records =====
export async function getClockRecords(orgId: string, filters?: {
  userId?: string; caseId?: string; caseName?: string; caseCode?: string;
  userName?: string; settlementType?: string; startTime?: string; endTime?: string; clockType?: 'in' | 'out';
}): Promise<ClockRecord[]> {
  if (isSupabase) {
    let q = supabase.from('clock_records').select('*, users!inner(name), cases!inner(name, code, settlement_type)').eq('org_id', orgId);
    if (filters?.userId) q = q.eq('user_id', filters.userId);
    if (filters?.caseId) q = q.eq('case_id', filters.caseId);
    if (filters?.userName) q = q.ilike('users.name', `%${filters.userName}%`);
    if (filters?.caseName) q = q.ilike('cases.name', `%${filters.caseName}%`);
    if (filters?.caseCode) q = q.ilike('cases.code', `%${filters.caseCode}%`);
    if (filters?.settlementType) q = q.eq('cases.settlement_type', filters.settlementType);
    if (filters?.startTime) {
      const col = filters.clockType === 'out' ? 'clock_out_time' : 'clock_in_time';
      q = q.gte(col, filters.startTime);
    }
    if (filters?.endTime) {
      const col = filters.clockType === 'out' ? 'clock_out_time' : 'clock_in_time';
      q = q.lte(col, filters.endTime);
    }
    q = q.order('clock_in_time', { ascending: false });
    const { data } = await q;
    return (data || []).map(toRecord);
  }
  // Local JSON fallback
  const db = readDB();
  let records = db.clockRecords.filter(r => r.orgId === orgId);
  if (filters) {
    if (filters.userId) records = records.filter(r => r.userId === filters.userId);
    if (filters.caseId) records = records.filter(r => r.caseId === filters.caseId);
    if (filters.userName) { const ids = new Set(db.users.filter(u => u.name.includes(filters.userName!)).map(u => u.id)); records = records.filter(r => ids.has(r.userId)); }
    if (filters.caseName) { const ids = new Set(db.cases.filter(c => c.name.includes(filters.caseName!)).map(c => c.id)); records = records.filter(r => ids.has(r.caseId)); }
    if (filters.caseCode) { const ids = new Set(db.cases.filter(c => c.code.includes(filters.caseCode!)).map(c => c.id)); records = records.filter(r => ids.has(r.caseId)); }
    if (filters.settlementType) { const ids = new Set(db.cases.filter(c => c.settlementType === filters.settlementType).map(c => c.id)); records = records.filter(r => ids.has(r.caseId)); }
    if (filters.startTime) { const s = new Date(filters.startTime); records = filters.clockType === 'out' ? records.filter(r => r.clockOutTime && new Date(r.clockOutTime) >= s) : records.filter(r => r.clockInTime && new Date(r.clockInTime) >= s); }
    if (filters.endTime) { const e = new Date(filters.endTime); records = filters.clockType === 'out' ? records.filter(r => r.clockOutTime && new Date(r.clockOutTime) <= e) : records.filter(r => r.clockInTime && new Date(r.clockInTime) <= e); }
  }
  records.sort((a, b) => (b.clockInTime ? new Date(b.clockInTime).getTime() : 0) - (a.clockInTime ? new Date(a.clockInTime).getTime() : 0));
  return records;
}

export async function createClockRecord(record: Omit<ClockRecord, 'id'>): Promise<ClockRecord> {
  if (isSupabase) {
    const { data } = await supabase.from('clock_records').insert({ org_id: record.orgId, user_id: record.userId, case_id: record.caseId, clock_in_time: record.clockInTime, clock_in_lat: record.clockInLat, clock_in_lng: record.clockInLng, clock_out_time: record.clockOutTime, clock_out_lat: record.clockOutLat, clock_out_lng: record.clockOutLng, salary: record.salary }).select().single();
    return toRecord(data);
  }
  const db = readDB(); const n: ClockRecord = { ...record, id: generateId() }; db.clockRecords.push(n); writeDB(db); return n;
}

export async function updateClockRecord(id: string, data: Partial<ClockRecord>): Promise<ClockRecord | null> {
  if (isSupabase) {
    const update: Record<string, unknown> = {};
    if (data.clockOutTime !== undefined) update.clock_out_time = data.clockOutTime;
    if (data.clockOutLat !== undefined) update.clock_out_lat = data.clockOutLat;
    if (data.clockOutLng !== undefined) update.clock_out_lng = data.clockOutLng;
    if (data.clockInTime !== undefined) update.clock_in_time = data.clockInTime;
    if (data.clockInLat !== undefined) update.clock_in_lat = data.clockInLat;
    if (data.clockInLng !== undefined) update.clock_in_lng = data.clockInLng;
    if (data.salary !== undefined) update.salary = data.salary;
    if (data.userId !== undefined) update.user_id = data.userId;
    if (data.caseId !== undefined) update.case_id = data.caseId;
    const { data: row } = await supabase.from('clock_records').update(update).eq('id', id).select().single();
    return row ? toRecord(row) : null;
  }
  const db = readDB(); const idx = db.clockRecords.findIndex(r => r.id === id); if (idx === -1) return null; db.clockRecords[idx] = { ...db.clockRecords[idx], ...data }; writeDB(db); return db.clockRecords[idx];
}

export async function deleteClockRecord(id: string): Promise<boolean> {
  if (isSupabase) { await supabase.from('clock_records').delete().eq('id', id); return true; }
  const db = readDB(); const idx = db.clockRecords.findIndex(r => r.id === id); if (idx === -1) return false; db.clockRecords.splice(idx, 1); writeDB(db); return true;
}

export async function findOpenClockRecord(userId: string, caseId: string): Promise<ClockRecord | undefined> {
  if (isSupabase) {
    const { data } = await supabase.from('clock_records').select('*').eq('user_id', userId).eq('case_id', caseId).not('clock_in_time', 'is', null).is('clock_out_time', null).limit(1).single();
    return data ? toRecord(data) : undefined;
  }
  return readDB().clockRecords.find(r => r.userId === userId && r.caseId === caseId && r.clockInTime && !r.clockOutTime);
}

/** 查找該使用者任意一筆未關閉的打卡紀錄（不限個案） */
export async function findAnyOpenClockRecord(userId: string): Promise<ClockRecord | undefined> {
  if (isSupabase) {
    const { data } = await supabase
      .from('clock_records').select('*')
      .eq('user_id', userId)
      .not('clock_in_time', 'is', null)
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? toRecord(data) : undefined;
  }
  return readDB().clockRecords.find(
    r => r.userId === userId && r.clockInTime && !r.clockOutTime
  );
}

// ===== Special Conditions =====
export async function getSpecialConditions(orgId: string): Promise<SpecialCondition[]> {
  if (isSupabase) { const { data } = await supabase.from('special_conditions').select('*').eq('org_id', orgId); return (data || []).map(toSC); }
  return readDB().specialConditions.filter(s => s.orgId === orgId);
}

export async function createSpecialCondition(sc: Omit<SpecialCondition, 'id'>): Promise<SpecialCondition> {
  if (isSupabase) {
    const { data } = await supabase.from('special_conditions').insert({ org_id: sc.orgId, name: sc.name, target: sc.target, multiplier: sc.multiplier, start_time: sc.startTime, end_time: sc.endTime }).select().single();
    return toSC(data);
  }
  const db = readDB(); const n: SpecialCondition = { ...sc, id: generateId() }; db.specialConditions.push(n); writeDB(db); return n;
}

export async function updateSpecialCondition(id: string, data: Partial<SpecialCondition>): Promise<SpecialCondition | null> {
  if (isSupabase) {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.target !== undefined) update.target = data.target;
    if (data.multiplier !== undefined) update.multiplier = data.multiplier;
    if (data.startTime !== undefined) update.start_time = data.startTime;
    if (data.endTime !== undefined) update.end_time = data.endTime;
    const { data: row } = await supabase.from('special_conditions').update(update).eq('id', id).select().single();
    return row ? toSC(row) : null;
  }
  const db = readDB(); const idx = db.specialConditions.findIndex(s => s.id === id); if (idx === -1) return null; db.specialConditions[idx] = { ...db.specialConditions[idx], ...data }; writeDB(db); return db.specialConditions[idx];
}

export async function deleteSpecialCondition(id: string): Promise<boolean> {
  if (isSupabase) { await supabase.from('special_conditions').delete().eq('id', id); return true; }
  const db = readDB(); const idx = db.specialConditions.findIndex(s => s.id === id); if (idx === -1) return false; db.specialConditions.splice(idx, 1); writeDB(db); return true;
}

// ===== Rate Settings =====
export async function getRateSettings(orgId: string): Promise<RateSettings[]> {
  if (isSupabase) { const { data } = await supabase.from('rate_settings').select('*').eq('org_id', orgId); return (data || []).map(toRS); }
  const db = readDB(); return (db.rateSettings || []).filter(r => r.orgId === orgId);
}

export async function createRateSettings(rs: Omit<RateSettings, 'id'>): Promise<RateSettings> {
  if (isSupabase) {
    const { data } = await supabase.from('rate_settings').insert({ org_id: rs.orgId, effective_date: rs.effectiveDate, label: rs.label, main_day_rate: rs.mainDayRate, main_night_rate: rs.mainNightRate, other_day_rate: rs.otherDayRate, other_night_rate: rs.otherNightRate, full_day_rate_24h: rs.fullDayRate24h, min_billing_hours: rs.minBillingHours, remote_area_subsidy: rs.remoteAreaSubsidy, dialysis_visit_fee: rs.dialysisVisitFee, dialysis_overtime_rate: rs.dialysisOvertimeRate }).select().single();
    return toRS(data);
  }
  const db = readDB(); if (!db.rateSettings) db.rateSettings = []; const n: RateSettings = { ...rs, id: generateId() }; db.rateSettings.push(n); writeDB(db); return n;
}

export async function updateRateSettings(id: string, data: Partial<RateSettings>): Promise<RateSettings | null> {
  if (isSupabase) {
    const update: Record<string, unknown> = {};
    if (data.effectiveDate !== undefined) update.effective_date = data.effectiveDate;
    if (data.label !== undefined) update.label = data.label;
    if (data.mainDayRate !== undefined) update.main_day_rate = data.mainDayRate;
    if (data.mainNightRate !== undefined) update.main_night_rate = data.mainNightRate;
    if (data.otherDayRate !== undefined) update.other_day_rate = data.otherDayRate;
    if (data.otherNightRate !== undefined) update.other_night_rate = data.otherNightRate;
    if (data.fullDayRate24h !== undefined) update.full_day_rate_24h = data.fullDayRate24h;
    if (data.minBillingHours !== undefined) update.min_billing_hours = data.minBillingHours;
    if (data.remoteAreaSubsidy !== undefined) update.remote_area_subsidy = data.remoteAreaSubsidy;
    if (data.dialysisVisitFee !== undefined) update.dialysis_visit_fee = data.dialysisVisitFee;
    if (data.dialysisOvertimeRate !== undefined) update.dialysis_overtime_rate = data.dialysisOvertimeRate;
    const { data: row } = await supabase.from('rate_settings').update(update).eq('id', id).select().single();
    return row ? toRS(row) : null;
  }
  const db = readDB(); if (!db.rateSettings) return null; const idx = db.rateSettings.findIndex(r => r.id === id); if (idx === -1) return null; db.rateSettings[idx] = { ...db.rateSettings[idx], ...data }; writeDB(db); return db.rateSettings[idx];
}

export async function deleteRateSettings(id: string): Promise<boolean> {
  if (isSupabase) { await supabase.from('rate_settings').delete().eq('id', id); return true; }
  const db = readDB(); if (!db.rateSettings) return false; const idx = db.rateSettings.findIndex(r => r.id === id); if (idx === -1) return false; db.rateSettings.splice(idx, 1); writeDB(db); return true;
}

// ===== Push Subscriptions =====
export async function savePushSubscription(userId: string, orgId: string, subscription: object): Promise<void> {
  if (isSupabase) {
    await supabase.from('push_subscriptions').upsert(
      { user_id: userId, org_id: orgId, subscription, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    return;
  }
  // Local fallback: no-op (push only works with Supabase in production)
}

export async function getPushSubscriptionsByUserIds(userIds: string[]): Promise<Array<{ userId: string; subscription: object }>> {
  if (isSupabase) {
    const { data } = await supabase.from('push_subscriptions').select('user_id, subscription').in('user_id', userIds);
    return (data || []).map(r => ({ userId: r.user_id, subscription: r.subscription }));
  }
  return [];
}

export async function deletePushSubscription(userId: string): Promise<void> {
  if (isSupabase) {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);
  }
}

/** 查詢所有超過指定時數未打卡下班的紀錄 */
export async function getOverdueClockRecords(hoursThreshold: number): Promise<ClockRecord[]> {
  if (isSupabase) {
    const threshold = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('clock_records')
      .select('*')
      .is('clock_out_time', null)
      .not('clock_in_time', 'is', null)
      .lt('clock_in_time', threshold);
    return (data || []).map(toRecord);
  }
  const cutoff = Date.now() - hoursThreshold * 60 * 60 * 1000;
  return readDB().clockRecords.filter(
    r => r.clockInTime && !r.clockOutTime && new Date(r.clockInTime).getTime() < cutoff
  );
}

// ===== Modification Requests =====
export async function getModificationRequests(orgId: string, filters?: { userId?: string; status?: string; recordId?: string }): Promise<ModificationRequest[]> {
  if (isSupabase) {
    let q = supabase.from('clock_modification_requests').select('*').eq('org_id', orgId);
    if (filters?.userId) q = q.eq('user_id', filters.userId);
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.recordId) q = q.eq('record_id', filters.recordId);
    q = q.order('created_at', { ascending: false });
    const { data } = await q;
    return (data || []).map(toModReq);
  }
  let reqs = (readDB().modificationRequests || []).filter(r => r.orgId === orgId);
  if (filters?.userId) reqs = reqs.filter(r => r.userId === filters.userId);
  if (filters?.status) reqs = reqs.filter(r => r.status === filters.status);
  if (filters?.recordId) reqs = reqs.filter(r => r.recordId === filters.recordId);
  return reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createModificationRequest(req: Omit<ModificationRequest, 'id' | 'status' | 'reviewedBy' | 'reviewedAt' | 'createdAt'>): Promise<ModificationRequest> {
  if (isSupabase) {
    const { data } = await supabase.from('clock_modification_requests').insert({
      org_id: req.orgId, record_id: req.recordId, user_id: req.userId,
      original_clock_in_time: req.originalClockInTime, original_clock_out_time: req.originalClockOutTime,
      proposed_clock_in_time: req.proposedClockInTime, proposed_clock_out_time: req.proposedClockOutTime,
      reason: req.reason, status: 'pending',
    }).select().single();
    return toModReq(data);
  }
  const db = readDB();
  if (!db.modificationRequests) db.modificationRequests = [];
  const n: ModificationRequest = { ...req, id: generateId(), status: 'pending', reviewedBy: null, reviewedAt: null, createdAt: new Date().toISOString() };
  db.modificationRequests.push(n);
  writeDB(db);
  return n;
}

export async function updateModificationRequestStatus(id: string, status: 'approved' | 'rejected', reviewedBy: string): Promise<ModificationRequest | null> {
  if (isSupabase) {
    const { data } = await supabase.from('clock_modification_requests').update({
      status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    return data ? toModReq(data) : null;
  }
  const db = readDB();
  const idx = (db.modificationRequests || []).findIndex(r => r.id === id);
  if (idx === -1) return null;
  db.modificationRequests[idx] = { ...db.modificationRequests[idx], status, reviewedBy, reviewedAt: new Date().toISOString() };
  writeDB(db);
  return db.modificationRequests[idx];
}

export async function getModificationRequestsByRecordId(recordId: string, status?: string): Promise<ModificationRequest[]> {
  if (isSupabase) {
    let q = supabase.from('clock_modification_requests').select('*').eq('record_id', recordId);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return (data || []).map(toModReq);
  }
  let reqs = (readDB().modificationRequests || []).filter(r => r.recordId === recordId);
  if (status) reqs = reqs.filter(r => r.status === status);
  return reqs;
}

export async function getModificationRequestStats(orgId: string, startDate?: string, endDate?: string): Promise<Array<{ userId: string; totalClocks: number; totalRequests: number; approved: number; rejected: number; pending: number }>> {
  // endDate 是日期字串 (YYYY-MM-DD)，需要 +1 天才能包含整天的資料
  // 因為 PostgreSQL 會把 '2026-03-11' 當作 '2026-03-11T00:00:00Z' (UTC 午夜)
  let endDateNext: string | undefined;
  if (endDate) {
    const d = new Date(endDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    endDateNext = d.toISOString().slice(0, 10);
  }

  if (isSupabase) {
    // 取得期間內的打卡紀錄（按使用者分組計數）
    let clockQ = supabase.from('clock_records').select('user_id', { count: 'exact' }).eq('org_id', orgId);
    if (startDate) clockQ = clockQ.gte('clock_in_time', startDate);
    if (endDateNext) clockQ = clockQ.lt('clock_in_time', endDateNext);
    const { data: clockData, error: clockErr } = await clockQ;
    if (clockErr) console.error('Stats clockQ error:', clockErr);
    const clockCounts = new Map<string, number>();
    (clockData || []).forEach((r: { user_id: string }) => clockCounts.set(r.user_id, (clockCounts.get(r.user_id) || 0) + 1));

    // 取得期間內的修改申請
    let reqQ = supabase.from('clock_modification_requests').select('*').eq('org_id', orgId);
    if (startDate) reqQ = reqQ.gte('created_at', startDate);
    if (endDateNext) reqQ = reqQ.lt('created_at', endDateNext);
    const { data: reqData, error: reqErr } = await reqQ;
    if (reqErr) console.error('Stats reqQ error:', reqErr);

    const reqStats = new Map<string, { total: number; approved: number; rejected: number; pending: number }>();
    (reqData || []).forEach((r: { user_id: string; status: string }) => {
      const s = reqStats.get(r.user_id) || { total: 0, approved: 0, rejected: 0, pending: 0 };
      s.total++;
      if (r.status === 'approved') s.approved++;
      else if (r.status === 'rejected') s.rejected++;
      else s.pending++;
      reqStats.set(r.user_id, s);
    });

    // 合併所有 userId
    const allUserIds = new Set([...clockCounts.keys(), ...reqStats.keys()]);
    return [...allUserIds].map(userId => ({
      userId,
      totalClocks: clockCounts.get(userId) || 0,
      totalRequests: reqStats.get(userId)?.total || 0,
      approved: reqStats.get(userId)?.approved || 0,
      rejected: reqStats.get(userId)?.rejected || 0,
      pending: reqStats.get(userId)?.pending || 0,
    }));
  }
  // Local JSON fallback
  const db = readDB();
  const records = db.clockRecords.filter(r => r.orgId === orgId && (!startDate || (r.clockInTime && r.clockInTime >= startDate)) && (!endDateNext || (r.clockInTime && r.clockInTime < endDateNext)));
  const reqs = (db.modificationRequests || []).filter(r => r.orgId === orgId && (!startDate || r.createdAt >= startDate) && (!endDateNext || r.createdAt < endDateNext));
  const clockCounts = new Map<string, number>();
  records.forEach(r => clockCounts.set(r.userId, (clockCounts.get(r.userId) || 0) + 1));
  const reqStats = new Map<string, { total: number; approved: number; rejected: number; pending: number }>();
  reqs.forEach(r => {
    const s = reqStats.get(r.userId) || { total: 0, approved: 0, rejected: 0, pending: 0 };
    s.total++; if (r.status === 'approved') s.approved++; else if (r.status === 'rejected') s.rejected++; else s.pending++;
    reqStats.set(r.userId, s);
  });
  const allUserIds = new Set([...clockCounts.keys(), ...reqStats.keys()]);
  return [...allUserIds].map(userId => ({
    userId, totalClocks: clockCounts.get(userId) || 0,
    totalRequests: reqStats.get(userId)?.total || 0, approved: reqStats.get(userId)?.approved || 0,
    rejected: reqStats.get(userId)?.rejected || 0, pending: reqStats.get(userId)?.pending || 0,
  }));
}

// ===== Enrichment =====
export async function enrichRecords(records: ClockRecord[]): Promise<Array<ClockRecord & { userName: string; caseName: string; caseCode: string }>> {
  if (isSupabase) {
    const userIds = [...new Set(records.map(r => r.userId))];
    const caseIds = [...new Set(records.map(r => r.caseId))];
    const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
    const { data: cases } = await supabase.from('cases').select('id, name, code').in('id', caseIds);
    const userMap = new Map((users || []).map(u => [u.id, u.name]));
    const caseMap = new Map((cases || []).map(c => [c.id, { name: c.name, code: c.code }]));
    return records.map(r => ({ ...r, userName: userMap.get(r.userId) || '未知', caseName: caseMap.get(r.caseId)?.name || '未知', caseCode: caseMap.get(r.caseId)?.code || '' }));
  }
  const db = readDB();
  return records.map(r => {
    const user = db.users.find(u => u.id === r.userId);
    const cas = db.cases.find(c => c.id === r.caseId);
    return { ...r, userName: user?.name || '未知', caseName: cas?.name || '未知', caseCode: cas?.code || '' };
  });
}
