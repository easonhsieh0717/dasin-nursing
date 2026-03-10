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
