// ===== 薪資計算 =====

/** 特護薪資比率：薪資 = 請款金額 × NURSE_SALARY_RATIO（公司抽成 10%） */
export const NURSE_SALARY_RATIO = 0.9;

/** 從請款金額計算特護薪資 */
export function calculateNurseSalary(billing: number): number {
  return Math.round(billing * NURSE_SALARY_RATIO);
}

interface SpecialConditionForCalc {
  multiplier: number;
  startTime: string;
  endTime: string;
  target?: string;
}

// UTC+8 小時偏移
const TW_OFFSET = 8 * 60; // minutes

/** 取得台灣時間的小時 (0-23)，不依賴伺服器時區 */
function getTWHour(date: Date): number {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const twMinutes = (utcMinutes + TW_OFFSET) % (24 * 60);
  return Math.floor(twMinutes / 60);
}

/**
 * 高效計算日/夜班分鐘數（用區間數學，非逐分鐘迴圈）
 * 日班 08:00~20:00 | 夜班 20:00~08:00（台灣時間 UTC+8）
 */
function calcDayNightMinutes(clockIn: string, clockOut: string): { dayMin: number; nightMin: number } {
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  if (end <= start) return { dayMin: 0, nightMin: 0 };

  const totalMin = Math.floor((end - start) / 60000);
  let dayMin = 0;

  // 以每天為單位處理
  const msPerDay = 24 * 60 * 60000;
  // 台灣時間的當天 00:00 (UTC)
  const startDate = new Date(clockIn);
  const twStartHour = getTWHour(startDate);
  // 找到當天台灣時間 00:00 的 UTC 時間戳
  let dayStartUTC = start - (twStartHour * 60 + startDate.getUTCMinutes()) * 60000;

  while (dayStartUTC < end) {
    // 這一天的日班區間：08:00~20:00 (TW) = dayStartUTC + 8h ~ dayStartUTC + 20h
    const dayBandStart = dayStartUTC + 8 * 3600000;
    const dayBandEnd = dayStartUTC + 20 * 3600000;

    // 計算打卡區間與日班區間的交集
    const overlapStart = Math.max(start, dayBandStart);
    const overlapEnd = Math.min(end, dayBandEnd);

    if (overlapEnd > overlapStart) {
      dayMin += Math.floor((overlapEnd - overlapStart) / 60000);
    }

    dayStartUTC += msPerDay;
  }

  const nightMin = totalMin - dayMin;
  return { dayMin, nightMin };
}

/**
 * 計算薪資：根據打卡時段的日/夜班小時數 × 對應費率 × 特殊倍率
 * 日班：08:00 ~ 20:00  →  dayRate (490/h)
 * 夜班：20:00 ~ 08:00  →  nightRate (530/h)
 * 不滿 1 小時的零頭無條件捨去（Math.floor）
 * 使用台灣時間 (UTC+8) 計算，不受伺服器時區影響
 */
export function calculateSalary(
  clockIn: string | null,
  clockOut: string | null,
  dayRate: number,
  nightRate: number,
  specialMultiplier: number
): number {
  if (!clockIn || !clockOut) return 0;

  const { dayMin, nightMin } = calcDayNightMinutes(clockIn, clockOut);

  // 不滿1小時的零頭無條件捨去
  const dayHours = Math.floor(dayMin / 60);
  const nightHours = Math.floor(nightMin / 60);

  const salary = (dayHours * dayRate + nightHours * nightRate) * specialMultiplier;
  return Math.round(salary);
}

/**
 * 取得特殊狀況倍率：檢查打卡時段是否與任何特殊狀況重疊
 * 若多個重疊取最大倍率，無重疊回傳 1
 * target 過濾：只套用 target 符合 orgCode 或 caseCode 的條件
 */
export function getSpecialMultiplier(
  clockIn: string | null,
  clockOut: string | null,
  specialConditions: SpecialConditionForCalc[],
  targetCode?: string
): number {
  if (!clockIn || !clockOut || specialConditions.length === 0) return 1;

  const shiftStart = new Date(clockIn).getTime();
  const shiftEnd = new Date(clockOut).getTime();

  let maxMultiplier = 1;

  for (const sc of specialConditions) {
    if (!sc.startTime || !sc.endTime) continue;

    // 若有指定 targetCode，只匹配 target 相符的特殊狀況
    if (targetCode && sc.target && sc.target !== targetCode) continue;

    const scStart = new Date(sc.startTime).getTime();
    const scEnd = new Date(sc.endTime).getTime();

    // 檢查是否有重疊
    if (shiftStart < scEnd && shiftEnd > scStart) {
      maxMultiplier = Math.max(maxMultiplier, sc.multiplier);
    }
  }

  return maxMultiplier;
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}年${month}月${day}日 ${hour}點${minute}分`;
}

/** 拆分日班/夜班時數（日班 08:00~20:00, 夜班 20:00~08:00），不滿1小時捨去，使用台灣時間 */
export function getDayNightHours(clockIn: string | null, clockOut: string | null): { dayHours: number; nightHours: number } {
  if (!clockIn || !clockOut) return { dayHours: 0, nightHours: 0 };
  const { dayMin, nightMin } = calcDayNightMinutes(clockIn, clockOut);
  return { dayHours: Math.floor(dayMin / 60), nightHours: Math.floor(nightMin / 60) };
}

export function formatCoords(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return '';
  return `${lat}, ${lng}`;
}

export function calculateHours(clockIn: string | null, clockOut: string | null): number {
  if (!clockIn || !clockOut) return 0;
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const hours = diff / (1000 * 60 * 60);
  // 以 0.5 小時為單位，四捨五入（8.12→8, 8.43→8.5, 8.8→9）
  return Math.round(hours * 2) / 2;
}

export function paginate<T>(items: T[], page: number, pageSize: number): { data: T[]; total: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return { data, total, totalPages };
}
