export function parseLocalDate(dateStr: string | Date | number): Date {
  if (dateStr instanceof Date) {
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
  }
  if (typeof dateStr === 'number') {
    const d = new Date(dateStr);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  
  const str = String(dateStr);
  if (str.includes('T')) {
    const d = new Date(str);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  
  const parts = str.split(/[-/]/);
  if (parts.length >= 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2].substring(0, 2)));
  }
  
  const d = new Date(str);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

export function diffDays(date1: Date | string, date2: Date | string) {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  // 忽略时间部分，只比较日期，避免夏令时导致相差不足 24 小时
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  const diff = utc2 - utc1;
  return Math.round(diff / 86400000);
}
