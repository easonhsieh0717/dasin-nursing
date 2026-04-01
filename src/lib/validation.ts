import { z } from 'zod';

// ─── Cases ───
export const createCaseSchema = z.object({
  name: z.string().min(1, '個案名稱必填').max(100),
  code: z.string().min(1, '個案代碼必填').max(50),
  caseType: z.enum(['主要地區', '其它地區']).default('主要地區'),
  settlementType: z.enum(['週', '月', '半月']).default('週'),
  remoteSubsidy: z.boolean().default(false),
});

export const updateCaseSchema = createCaseSchema.partial().extend({
  id: z.string().min(1, '缺少 ID'),
});

// ─── Nurses (Users) ───
export const createNurseSchema = z.object({
  name: z.string().min(1, '名稱必填').max(100),
  account: z.string().min(1, '帳號必填').max(100),
  password: z.string().min(1, '密碼必填').max(100),
  hourlyRate: z.number().min(0).max(100000).default(0),
  bank: z.string().max(200).default(''),
  accountNo: z.string().max(100).default(''),
  accountName: z.string().max(100).default(''),
  defaultCaseId: z.string().nullish(),
  note: z.string().max(500).default(''),
});

export const updateNurseSchema = z.object({
  id: z.string().min(1, '缺少 ID'),
  name: z.string().min(1).max(100).optional(),
  account: z.string().min(1).max(100).optional(),
  password: z.string().min(1).max(100).optional(),
  hourlyRate: z.number().min(0).max(100000).optional(),
  bank: z.string().max(200).optional(),
  accountNo: z.string().max(100).optional(),
  accountName: z.string().max(100).optional(),
  defaultCaseId: z.string().nullish(),
  note: z.string().max(500).optional(),
});

// ─── Clock Records ───
export const createRecordSchema = z.object({
  userId: z.string().min(1, '缺少特護 ID'),
  caseId: z.string().min(1, '缺少個案 ID'),
  clockInTime: z.string().nullable().default(null),
  clockOutTime: z.string().nullable().default(null),
  clockInLat: z.number().nullable().default(null),
  clockInLng: z.number().nullable().default(null),
  clockOutLat: z.number().nullable().default(null),
  clockOutLng: z.number().nullable().default(null),
  salary: z.number().min(0).default(0),
});

export const updateRecordSchema = z.object({
  id: z.string().min(1, '缺少 ID'),
  userId: z.string().min(1).optional(),
  caseId: z.string().min(1).optional(),
  clockInTime: z.string().nullable().optional(),
  clockOutTime: z.string().nullable().optional(),
  clockInLat: z.number().nullable().optional(),
  clockInLng: z.number().nullable().optional(),
  clockOutLat: z.number().nullable().optional(),
  clockOutLng: z.number().nullable().optional(),
  salary: z.number().min(0).optional(),
});

// ─── Special Conditions ───
export const specialConditionSchema = z.object({
  id: z.string().optional(),
  dayType: z.string().min(1, '缺少日期類型'),
  date: z.string().optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  multiplier: z.number().min(0.1).max(10),
  note: z.string().max(200).default(''),
});

// ─── Rate Settings ───
export const rateSettingsSchema = z.object({
  id: z.string().optional(),
  dayRate: z.number().min(0),
  nightRate: z.number().min(0),
  nightStartHour: z.number().min(0).max(23),
  nightEndHour: z.number().min(0).max(23),
  salaryRatio: z.number().min(0).max(1),
});

// ─── Receipts ───
export const createReceiptSchema = z.object({
  caseId: z.string().min(1, '缺少個案 ID'),
  receiptNumber: z.string().min(1, '缺少收據號碼').max(100),
  amount: z.number().min(0),
  receiptDate: z.string().min(1, '缺少收據日期'),
  note: z.string().max(500).default(''),
});

export const updateReceiptSchema = createReceiptSchema.partial().extend({
  id: z.string().min(1, '缺少 ID'),
});

/** Parse body with a zod schema; returns parsed data or null + error message */
export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues.map(i => i.message).join('; ');
    return { data: null, error: msg };
  }
  return { data: result.data, error: null };
}
