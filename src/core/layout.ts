import type { FlatTaskSnapshot } from './types'

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface VirtualScrollIndices {
  startIndex: number;
  endIndex: number;
  renderStartIndex: number;
  renderEndIndex: number;
  offsetY: number;
}

export interface ColumnScrollIndices {
  startColIndex: number;
  endColIndex: number;
  renderStartColIndex: number;
  renderEndColIndex: number;
  offsetX: number;
}

// Core scale constants
export const SCALE_CONFIG = {
  day: { columnWidth: 44, label: '日' },
  week: { columnWidth: 120, label: '周' },
  month: { columnWidth: 180, label: '月' }
} as const;

export function getPxPerDay(columnWidth: number, scale: 'day' | 'week' | 'month'): number {
  if (scale === 'week') return columnWidth / 7
  if (scale === 'month') return columnWidth / 30
  return columnWidth
}

export function getBarLeftPx(
  task: FlatTaskSnapshot,
  columnWidth: number,
  getVisibleDayIndex: (date: Date) => number
): number {
  const startD = normalizeDate(task.startDate)
  return getVisibleDayIndex(startD) * columnWidth
}

export function getBarWidthPx(
  task: FlatTaskSnapshot,
  columnWidth: number,
  scale: 'day' | 'week' | 'month',
  getVisibleDayIndex: (date: Date) => number,
  getVisibleDaysCount: (start: Date, end: Date) => number
): number {
  if (task.type === 'milestone') {
    return Math.max(14, columnWidth * 0.35)
  }

  const startD = normalizeDate(task.startDate)
  const endD = normalizeDate(task.endDate)

  if (scale === 'week' || scale === 'month') {
    const span = getVisibleDayIndex(endD) - getVisibleDayIndex(startD) + 1
    return Math.max(columnWidth * 0.25, span * columnWidth)
  }

  const durationDays = getVisibleDaysCount(startD, endD)
  return Math.max(columnWidth * 0.35, durationDays * columnWidth)
}

export function getMinBarWidthPx(columnWidth: number): number {
  return Math.max(10, columnWidth * 0.2)
}

export function getRowTopPx(index: number, rowHeight: number): number {
  return index * rowHeight + 8
}

export function getRowHeight(rowHeight: number): number {
  return rowHeight - 16
}

export function getDependencyPath(
  fromX: number,
  fromY: number,
  fromW: number,
  toX: number,
  toY: number
): { path: string; arrow: string } {
  const startX = fromX + fromW
  const startY = fromY
  const endX = toX
  const endY = toY
  const diffX = endX - startX

  let path: string
  if (diffX > 20) {
    path = `M ${startX},${startY} C ${startX + diffX / 2},${startY} ${endX - diffX / 2},${endY} ${endX},${endY}`
  } else {
    path = `M ${startX},${startY} L ${startX + 10},${startY} C ${startX + 20},${startY} ${startX + 20},${startY + 15} ${startX + 10},${startY + 15} L ${endX - 10},${startY + 15} C ${endX - 20},${startY + 15} ${endX - 20},${endY} ${endX - 10},${endY} L ${endX},${endY}`
  }

  const arrow = `${endX},${endY} ${endX - 6},${endY - 4} ${endX - 6},${endY + 4}`

  return { path, arrow }
}

export function computeDateRange(
  tasks: Array<{ startDate: string; endDate: string }>,
  scale: 'day' | 'week' | 'month',
  options?: {
    weekStartsOn?: number;
    manualStartDate?: Date | null;
    manualEndDate?: Date | null;
    paddingDays?: number;
  }
): DateRange {
  const pad = options?.paddingDays ?? 7;
  const weekStartsOn = options?.weekStartsOn ?? 1;

  let minDate: Date;
  let maxDate: Date;

  if (tasks.length === 0) {
    const now = new Date();
    minDate = new Date(now.getFullYear(), now.getMonth(), 1);
    maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else {
    minDate = stripTime(new Date(tasks[0].startDate));
    maxDate = stripTime(new Date(tasks[0].endDate));

    for (let i = 1; i < tasks.length; i++) {
      const s = stripTime(new Date(tasks[i].startDate));
      const e = stripTime(new Date(tasks[i].endDate));
      if (s < minDate) minDate = s;
      if (e > maxDate) maxDate = e;
    }

    minDate.setDate(minDate.getDate() - pad);
    maxDate.setDate(maxDate.getDate() + pad);
  }

  if (options?.manualStartDate) minDate = options.manualStartDate;
  if (options?.manualEndDate) maxDate = options.manualEndDate;

  if (scale === 'week') {
    const dow = (minDate.getDay() - weekStartsOn + 7) % 7;
    minDate.setDate(minDate.getDate() - dow);
    const endDow = (maxDate.getDay() - weekStartsOn + 7) % 7;
    maxDate.setDate(maxDate.getDate() - endDow + 6);
  } else if (scale === 'month') {
    minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
  }

  return { startDate: minDate, endDate: maxDate };
}

export function computeVirtualScroll(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalRows: number,
  bufferSize = 2
): VirtualScrollIndices {
  const startIndex = Math.floor(scrollTop / rowHeight);
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight));
  const renderStartIndex = Math.max(0, startIndex - bufferSize);
  const renderEndIndex = Math.min(totalRows, endIndex + bufferSize);
  const offsetY = renderStartIndex * rowHeight;

  return { startIndex, endIndex, renderStartIndex, renderEndIndex, offsetY };
}

export function computeColumnScroll(
  scrollLeft: number,
  viewportWidth: number,
  columnWidth: number,
  totalCols: number,
  bufferSize = 2
): ColumnScrollIndices {
  const startColIndex = Math.floor(scrollLeft / columnWidth);
  const endColIndex = Math.ceil((scrollLeft + viewportWidth) / columnWidth);
  const renderStartColIndex = Math.max(0, startColIndex - bufferSize);
  const renderEndColIndex = Math.min(totalCols, endColIndex + bufferSize);
  const offsetX = renderStartColIndex * columnWidth;

  return { startColIndex, endColIndex, renderStartColIndex, renderEndColIndex, offsetX };
}

export function computeActiveDates(
  startDate: Date,
  endDate: Date,
  scale: 'day' | 'week' | 'month',
  options?: {
    hideHolidays?: boolean;
    isNonWorkingDay?: (date: Date) => boolean;
  }
): Date[] {
  const dates: Date[] = [];
  const hide = options?.hideHolidays ?? false;
  const isNonWorking = options?.isNonWorkingDay;

  if (scale === 'week') {
    const weeks = Math.max(1, Math.floor(diffDays(startDate, endDate) / 7) + 1);
    for (let i = 0; i < weeks; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i * 7);
      dates.push(d);
    }
  } else if (scale === 'month') {
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (current <= end) {
      dates.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
  } else {
    let current = new Date(startDate);
    while (current <= endDate) {
      if (!hide || !isNonWorking || !isNonWorking(current)) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
  }

  return dates;
}

function diffDays(a: Date, b: Date): number {
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utc2 - utc1) / 86400000);
}

function normalizeDate(input: string | Date): Date {
  if (input instanceof Date) return stripTime(input)
  return stripTime(new Date(input + (input.includes('T') ? '' : 'T00:00:00')))
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
