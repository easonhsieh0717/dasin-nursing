// ===== 薪資計算 =====
interface SpecialConditionForCalc {
  multiplier: number;
  startTime: string;
  endTime: string;
}

/**
 * 計算薪資：根據打卡時段的日/夜班小時數 × 對應費率 × 特殊倍率
 * 日班：06:00 ~ 22:00  →  dayRate
 * 夜班：22:00 ~ 06:00  →  nightRate
 */
export function calculateSalary(
  clockIn: string | null,
  clockOut: string | null,
  dayRate: number,
  nightRate: number,
  specialMultiplier: number
): number {
  if (!clockIn || !clockOut) return 0;

  const start = new Date(clockIn);
  const end = new Date(clockOut);
  if (end.getTime() <= start.getTime()) return 0;

  let dayMinutes = 0;
  let nightMinutes = 0;

  // 以每分鐘為單位計算日夜班時數
  const current = new Date(start);
  while (current.getTime() < end.getTime()) {
    const hour = current.getHours();
    if (hour >= 6 && hour < 22) {
      dayMinutes++;
    } else {
      nightMinutes++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  const dayHours = dayMinutes / 60;
  const nightHours = nightMinutes / 60;

  const salary = (dayHours * dayRate + nightHours * nightRate) * specialMultiplier;
  return Math.round(salary);
}

/**
 * 取得特殊狀況倍率：檢查打卡時段是否與任何特殊狀況重疊
 * 若多個重疊取最大倍率，無重疊回傳 1
 */
export function getSpecialMultiplier(
  clockIn: string | null,
  clockOut: string | null,
  specialConditions: SpecialConditionForCalc[]
): number {
  if (!clockIn || !clockOut || specialConditions.length === 0) return 1;

  const shiftStart = new Date(clockIn).getTime();
  const shiftEnd = new Date(clockOut).getTime();

  let maxMultiplier = 1;

  for (const sc of specialConditions) {
    if (!sc.startTime || !sc.endTime) continue;
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

export function formatCoords(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return '';
  return `${lat}, ${lng}`;
}

export function calculateHours(clockIn: string | null, clockOut: string | null): number {
  if (!clockIn || !clockOut) return 0;
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
}

export function paginate<T>(items: T[], page: number, pageSize: number): { data: T[]; total: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return { data, total, totalPages };
}
