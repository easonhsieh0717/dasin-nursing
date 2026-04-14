import { getRateSettings, getSpecialConditions, getCases, getUserById, getRatePeriodsForProfiles } from './db';
import type { RateSettings, SpecialCondition, Case, RatePeriod } from './db';
import { calculateSalary, getSpecialMultiplier, calculateNurseSalary, getDayNightHours, getRatesForCase } from './utils';

export interface BillingResult {
  billing: number;
  nurseSalary: number;
  dayHours: number;
  nightHours: number;
}

export interface BillingContext {
  latestRate: RateSettings | null;
  specialConditions: SpecialCondition[];
  cases: Case[];
  /** Map of profileId → RatePeriod[] */
  profilePeriods: Map<string, RatePeriod[]>;
}

/**
 * Parse "HHMM" string → minutes from midnight.
 */
function hhmm(t: string): number {
  const h = parseInt(t.slice(0, 2), 10);
  const m = parseInt(t.slice(2, 4), 10);
  return h * 60 + m;
}

/**
 * Calculate hours a shift overlaps with a time period.
 * Period may cross midnight (e.g. 2000-0800 means 20:00 to 08:00 next day).
 */
function overlapHours(
  inTime: Date,
  outTime: Date,
  periodStart: string, // "0800"
  periodEnd: string,   // "2000"
): number {
  const totalMinutes = (outTime.getTime() - inTime.getTime()) / 60000;
  if (totalMinutes <= 0) return 0;

  const ps = hhmm(periodStart); // period start in minutes
  const pe = hhmm(periodEnd);   // period end in minutes
  const crosses = pe <= ps;     // e.g. 2000-0800 crosses midnight

  let total = 0;
  // Iterate over each day in the shift
  const startDay = new Date(inTime);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(outTime);
  endDay.setHours(0, 0, 0, 0);

  for (let d = startDay.getTime(); d <= endDay.getTime(); d += 86400000) {
    const dayStart = new Date(d);

    let periodStartDt: Date, periodEndDt: Date;
    if (!crosses) {
      // e.g. 0800-2000: both on same day
      periodStartDt = new Date(d + ps * 60000);
      periodEndDt = new Date(d + pe * 60000);
    } else {
      // e.g. 2000-0800: starts on this day, ends next day
      periodStartDt = new Date(d + ps * 60000);
      periodEndDt = new Date(d + (pe + 1440) * 60000); // +24h
    }
    void dayStart;

    const overlapStart = Math.max(inTime.getTime(), periodStartDt.getTime());
    const overlapEnd = Math.min(outTime.getTime(), periodEndDt.getTime());
    if (overlapEnd > overlapStart) {
      total += (overlapEnd - overlapStart) / 3600000;
    }
  }
  return total;
}

/** Compute billing using flexible rate periods */
function computeBillingFromPeriods(
  clockInTime: string,
  clockOutTime: string,
  periods: RatePeriod[],
  multiplier: number,
): { billing: number; nurseSalary: number } {
  const inTime = new Date(clockInTime);
  const outTime = new Date(clockOutTime);
  let billing = 0;
  let nurseSalary = 0;

  for (const period of periods) {
    const hours = overlapHours(inTime, outTime, period.startTime, period.endTime);
    billing += hours * period.billingRate * multiplier;
    nurseSalary += hours * period.nurseRate * multiplier;
  }

  return { billing: Math.round(billing), nurseSalary: Math.round(nurseSalary) };
}

/** 計算單筆紀錄的 billing（純函式，不存取 DB） */
export function computeBilling(
  clockInTime: string | null,
  clockOutTime: string | null,
  salary: number,
  caseType: string,
  remoteSubsidy: boolean,
  latestRate: RateSettings | null,
  specialConditions: SpecialCondition[],
  nurseHourlyRate?: number,
  ratePeriods?: RatePeriod[],
): BillingResult {
  if (!clockInTime || !clockOutTime) {
    return { billing: 0, nurseSalary: 0, dayHours: 0, nightHours: 0 };
  }

  const multiplier = getSpecialMultiplier(clockInTime, clockOutTime, specialConditions);
  const { dayHours, nightHours } = getDayNightHours(clockInTime, clockOutTime);

  let billing: number;
  let nurseSalary: number;

  if (ratePeriods && ratePeriods.length > 0) {
    // P6: use flexible periods
    const result = computeBillingFromPeriods(clockInTime, clockOutTime, ratePeriods, multiplier);
    billing = result.billing;
    nurseSalary = result.nurseSalary;
  } else {
    // Standard day/night rates
    const { dayRate, nightRate } = latestRate
      ? getRatesForCase(latestRate, caseType)
      : { dayRate: 490, nightRate: 530 };

    billing = calculateSalary(clockInTime, clockOutTime, dayRate, nightRate, multiplier);

    if (nurseHourlyRate && nurseHourlyRate > 0) {
      const totalHours = dayHours + nightHours;
      nurseSalary = Math.round(totalHours * nurseHourlyRate * multiplier);
    } else {
      nurseSalary = calculateNurseSalary(billing);
    }
  }

  if (remoteSubsidy) {
    billing += latestRate?.remoteAreaSubsidy ?? 500;
  }

  // 手動覆寫：salary > 0 表示管理員手動設定金額
  if (salary > 0) {
    billing = salary;
    // nurse salary still computed from periods / hourly rate
  }

  return { billing, nurseSalary, dayHours, nightHours };
}

/** 載入 org 的費率/特殊狀況/個案 context (含 rate profiles) */
export async function loadBillingContext(orgId: string): Promise<BillingContext> {
  const allRates = await getRateSettings(orgId);
  const latestRate = allRates.sort((a, b) =>
    new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
  )[0] || null;
  const specialConditions = await getSpecialConditions(orgId);
  const cases = await getCases(orgId);

  // Load rate profiles for cases that have them
  const profileIds = [...new Set(cases.map(c => c.rateProfileId).filter(Boolean) as string[])];
  const allPeriods = profileIds.length ? await getRatePeriodsForProfiles(profileIds) : [];
  const profilePeriods = new Map<string, RatePeriod[]>();
  for (const pid of profileIds) {
    profilePeriods.set(pid, allPeriods.filter(p => p.profileId === pid));
  }

  return { latestRate, specialConditions, cases, profilePeriods };
}

/** 計算單筆紀錄的 billing（自動載入 context 或使用已載入的） */
export async function computeBillingForRecord(
  record: { clockInTime: string | null; clockOutTime: string | null; salary: number; caseId: string; orgId: string; userId?: string },
  context?: BillingContext,
): Promise<BillingResult> {
  const ctx = context || await loadBillingContext(record.orgId);
  const targetCase = ctx.cases.find(c => c.id === record.caseId);

  // Get rate periods for this case's profile (if any)
  const ratePeriods = targetCase?.rateProfileId
    ? ctx.profilePeriods.get(targetCase.rateProfileId)
    : undefined;

  // 取得特護時薪（若有 userId）
  let nurseHourlyRate = 0;
  if (record.userId) {
    const nurse = await getUserById(record.userId);
    nurseHourlyRate = nurse?.hourlyRate ?? 0;
  }

  return computeBilling(
    record.clockInTime,
    record.clockOutTime,
    record.salary,
    targetCase?.caseType || '主要地區',
    targetCase?.remoteSubsidy ?? false,
    ctx.latestRate,
    ctx.specialConditions,
    nurseHourlyRate,
    ratePeriods,
  );
}
