import { getRateSettings, getSpecialConditions, getCases, getUserById } from './db';
import type { RateSettings, SpecialCondition, Case } from './db';
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
): BillingResult {
  if (!clockInTime || !clockOutTime) {
    return { billing: 0, nurseSalary: 0, dayHours: 0, nightHours: 0 };
  }

  const { dayRate, nightRate } = latestRate
    ? getRatesForCase(latestRate, caseType)
    : { dayRate: 490, nightRate: 530 };

  const multiplier = getSpecialMultiplier(clockInTime, clockOutTime, specialConditions);
  let billing = calculateSalary(clockInTime, clockOutTime, dayRate, nightRate, multiplier);

  if (remoteSubsidy) {
    billing += latestRate?.remoteAreaSubsidy ?? 500;
  }

  // 手動覆寫：salary > 0 表示管理員手動設定金額
  if (salary > 0) {
    billing = salary;
  }

  const { dayHours, nightHours } = getDayNightHours(clockInTime, clockOutTime);

  // 特護薪資：若特護有自己的時薪 > 0，用特護時薪 × 時數計算；否則用請款金額 × 0.9
  let nurseSalary: number;
  if (nurseHourlyRate && nurseHourlyRate > 0) {
    const totalHours = dayHours + nightHours;
    nurseSalary = Math.round(totalHours * nurseHourlyRate * multiplier);
  } else {
    nurseSalary = calculateNurseSalary(billing);
  }

  return { billing, nurseSalary, dayHours, nightHours };
}

/** 載入 org 的費率/特殊狀況/個案 context */
export async function loadBillingContext(orgId: string): Promise<BillingContext> {
  const allRates = await getRateSettings(orgId);
  const latestRate = allRates.sort((a, b) =>
    new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
  )[0] || null;
  const specialConditions = await getSpecialConditions(orgId);
  const cases = await getCases(orgId);
  return { latestRate, specialConditions, cases };
}

/** 計算單筆紀錄的 billing（自動載入 context 或使用已載入的） */
export async function computeBillingForRecord(
  record: { clockInTime: string | null; clockOutTime: string | null; salary: number; caseId: string; orgId: string; userId?: string },
  context?: BillingContext,
): Promise<BillingResult> {
  const ctx = context || await loadBillingContext(record.orgId);
  const targetCase = ctx.cases.find(c => c.id === record.caseId);

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
  );
}
