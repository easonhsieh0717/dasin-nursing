import { z } from 'zod';

// ─── Cases ───
export const createCaseSchema = z.object({
  name: z.string().min(1, '個案名稱必填').max(100),
  code: z.string().min(1, '個案代碼必填').max(50),
  caseType: z.enum(['主要地區', '其它地區']).default('主要地區'),
  settlementType: z.enum(['週', '月', '半月']).default('週'),
  remoteSubsidy: z.boolean().default(false),
  rateProfileId: z.string().nullish(),
});

export const updateCaseSchema = createCaseSchema.partial().extend({
  id: z.string().min(1, '缺少 ID'),
});

// ─── Nurses (Users) ───
export const createNurseSchema = z.object({
  name: z.string().min(1, '名稱必填').max(100),
  account: z.string().min(1, '帳號必填').max(100),
  password: z.string().min(1).max(100).default(''), // empty = use account name as default
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

// ─── Special Conditions (Admin) ───
export const specialConditionSchema = z.object({
  id: z.string().optional(),
  dayType: z.string().min(1, '缺少日期類型').max(100),
  date: z.string().max(50).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  multiplier: z.number().min(0.1).max(10),
  note: z.string().max(200).default(''),
});

export const createSpecialSchema = z.object({
  name: z.string().min(1, '名稱必填').max(100),
  target: z.string().min(1, '對象必填').max(100),
  multiplier: z.number().min(0.1).max(10),
  startTime: z.string().min(1, '開始時間必填'),
  endTime: z.string().min(1, '結束時間必填'),
});

export const updateSpecialSchema = createSpecialSchema.partial().extend({
  id: z.string().min(1, '缺少 ID'),
});

// ─── Rate Settings (Admin) ───
export const rateSettingsSchema = z.object({
  id: z.string().optional(),
  dayRate: z.number().min(0),
  nightRate: z.number().min(0),
  nightStartHour: z.number().min(0).max(23),
  nightEndHour: z.number().min(0).max(23),
  salaryRatio: z.number().min(0).max(1),
});

export const createRateSettingsSchema = z.object({
  effectiveDate: z.string().min(1, '生效日期必填'),
  label: z.string().max(200).default(''),
  mainDayRate: z.number().min(0).max(100000),
  mainNightRate: z.number().min(0).max(100000),
  otherDayRate: z.number().min(0).max(100000),
  otherNightRate: z.number().min(0).max(100000),
  fullDayRate24h: z.number().min(0).max(1000000).default(0),
  minBillingHours: z.number().min(0).max(24).default(0),
  remoteAreaSubsidy: z.number().min(0).max(100000).default(0),
  dialysisVisitFee: z.number().min(0).max(100000).default(0),
  dialysisOvertimeRate: z.number().min(0).max(100000).default(0),
});

// ─── Receipts (Admin) ───
export const createReceiptSchema = z.object({
  caseId: z.string().min(1, '缺少個案 ID'),
  recipientName: z.string().min(1, '收件人必填').max(100),
  serviceStartDate: z.string().min(1, '服務起始日必填'),
  serviceEndDate: z.string().min(1, '服務結束日必填'),
  serviceDays: z.number().min(0).default(0),
  serviceAmount: z.number().min(0).default(0),
  transportationFee: z.number().min(0).default(0),
  totalAmount: z.number().min(0).default(0),
  dispatchCompany: z.string().max(200).default('達心特護'),
  receiptDate: z.string().min(1, '收據日期必填'),
  note: z.string().max(500).default(''),
  serviceLocation: z.string().max(200).default(''),
});

export const updateReceiptSchema = createReceiptSchema.partial().extend({
  id: z.string().min(1, '缺少 ID'),
});

// ─── Modification Requests ───
export const reviewModificationSchema = z.object({
  id: z.string().min(1, '缺少 ID'),
  action: z.enum(['approved', 'rejected'], { message: '操作必須是 approved 或 rejected' }),
});

// ─── Image Upload Validation ───
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
};

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `不支援的檔案類型: ${file.type}，僅接受 JPG/PNG/WebP/GIF` };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { valid: false, error: '檔案大小超過 4MB 上限' };
  }
  return { valid: true };
}

export async function validateImageBytes(buffer: ArrayBuffer): Promise<{ valid: boolean; error?: string }> {
  const bytes = new Uint8Array(buffer).slice(0, 8);
  const isValidMagic = Object.values(MAGIC_BYTES).some(magic =>
    magic.every((b, i) => bytes[i] === b)
  );
  if (!isValidMagic) {
    return { valid: false, error: '檔案內容非有效圖片格式' };
  }
  return { valid: true };
}

/** Parse body with a zod schema; returns parsed data or null + error message */
export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues.map(i => i.message).join('; ');
    return { data: null, error: msg };
  }
  return { data: result.data, error: null };
}
