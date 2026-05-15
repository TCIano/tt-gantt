import { describe, it, expect } from 'vitest'
import {
  getPxPerDay,
  getMinBarWidthPx,
  getRowTopPx,
  getRowHeight,
  computeDateRange,
  computeVirtualScroll,
  computeColumnScroll,
  computeActiveDates
} from '../layout'

describe('getPxPerDay', () => {
  it('returns columnWidth for day scale', () => {
    expect(getPxPerDay(44, 'day')).toBe(44)
    expect(getPxPerDay(100, 'day')).toBe(100)
  })

  it('returns columnWidth / 7 for week scale', () => {
    expect(getPxPerDay(77, 'week')).toBe(11)
    expect(getPxPerDay(140, 'week')).toBe(20)
  })

  it('returns columnWidth / 30 for month scale', () => {
    expect(getPxPerDay(180, 'month')).toBe(6)
    expect(getPxPerDay(90, 'month')).toBe(3)
  })
})

describe('getMinBarWidthPx', () => {
  it('returns max of 10px and 20% of columnWidth', () => {
    expect(getMinBarWidthPx(44)).toBe(10)
    expect(getMinBarWidthPx(100)).toBe(20)
    expect(getMinBarWidthPx(30)).toBe(10)
  })
})

describe('getRowTopPx', () => {
  it('computes row top position with 8px padding', () => {
    expect(getRowTopPx(0, 40)).toBe(8)
    expect(getRowTopPx(1, 40)).toBe(48)
    expect(getRowTopPx(5, 30)).toBe(158)
  })
})

describe('getRowHeight', () => {
  it('returns rowHeight minus 16', () => {
    expect(getRowHeight(40)).toBe(24)
    expect(getRowHeight(50)).toBe(34)
  })
})

describe('computeDateRange', () => {
  it('computes range from task dates with padding', () => {
    const tasks = [
      { startDate: '2026-01-05', endDate: '2026-01-10' },
      { startDate: '2026-01-15', endDate: '2026-01-20' }
    ]
    const result = computeDateRange(tasks, 'day')
    // min padded by -7: Jan 5 - 7 = Dec 29
    // max padded by +7: Jan 20 + 7 = Jan 27
    expect(result.startDate.getMonth()).toBe(11) // Dec (0-indexed)
    expect(result.startDate.getDate()).toBe(29)
    expect(result.endDate.getMonth()).toBe(0) // Jan
    expect(result.endDate.getDate()).toBe(27)
  })

  it('returns current month range for empty tasks', () => {
    const result = computeDateRange([], 'day')
    const now = new Date()
    expect(result.startDate.getFullYear()).toBe(now.getFullYear())
    expect(result.startDate.getMonth()).toBe(now.getMonth())
    expect(result.startDate.getDate()).toBe(1)
  })

  it('snaps to week boundaries in week scale', () => {
    const tasks = [{ startDate: '2026-01-15', endDate: '2026-01-20' }]
    const result = computeDateRange(tasks, 'week', { weekStartsOn: 1 })
    // Jan 15 - 7 days = Jan 8, snap to Monday (Jan 5)
    // Jan 20 + 7 days = Jan 27, snap to Sunday (Feb 1)
    expect(result.startDate.getDate()).toBeLessThanOrEqual(8)
    expect(result.startDate.getDay()).toBe(1) // Monday
  })

  it('snaps to month boundaries in month scale', () => {
    const tasks = [{ startDate: '2026-01-15', endDate: '2026-01-20' }]
    const result = computeDateRange(tasks, 'month')
    expect(result.startDate.getDate()).toBe(1) // Jan 1
    expect(result.endDate.getDate()).toBe(31) // Jan 31
  })

  it('respects manual overrides', () => {
    const tasks = [{ startDate: '2026-01-05', endDate: '2026-01-10' }]
    const manualStart = new Date(2025, 11, 1)
    const manualEnd = new Date(2026, 2, 1)
    const result = computeDateRange(tasks, 'day', {
      manualStartDate: manualStart,
      manualEndDate: manualEnd
    })
    expect(result.startDate.getTime()).toBe(manualStart.getTime())
    expect(result.endDate.getTime()).toBe(manualEnd.getTime())
  })
})

describe('computeVirtualScroll', () => {
  it('computes indices at top of scroll', () => {
    const result = computeVirtualScroll(0, 500, 40, 100)
    expect(result.startIndex).toBe(0)
    expect(result.endIndex).toBe(13) // ceil(500/40) = 13
    expect(result.renderStartIndex).toBe(0)
    expect(result.renderEndIndex).toBe(15) // 13 + 2
    expect(result.offsetY).toBe(0)
  })

  it('computes indices at middle of scroll', () => {
    const result = computeVirtualScroll(400, 500, 40, 100)
    expect(result.startIndex).toBe(10)
    expect(result.renderStartIndex).toBe(8)
    expect(result.offsetY).toBe(8 * 40)
  })

  it('clamps to total rows', () => {
    const result = computeVirtualScroll(5000, 500, 40, 20)
    expect(result.endIndex).toBe(20)
    expect(result.renderEndIndex).toBe(20)
  })
})

describe('computeColumnScroll', () => {
  it('computes column indices at left', () => {
    const result = computeColumnScroll(0, 800, 44, 365)
    expect(result.startColIndex).toBe(0)
    expect(result.renderStartColIndex).toBe(0)
    expect(result.offsetX).toBe(0)
  })

  it('computes column indices scrolled right', () => {
    const result = computeColumnScroll(500, 800, 44, 365)
    expect(result.startColIndex).toBe(11) // floor(500/44)
    expect(result.offsetX).toBe(9 * 44) // (11-2) * 44
  })
})

describe('computeActiveDates', () => {
  it('generates daily dates in day scale', () => {
    const start = new Date(2026, 0, 1)
    const end = new Date(2026, 0, 5)
    const result = computeActiveDates(start, end, 'day')
    expect(result).toHaveLength(5)
    expect(result[0].getDate()).toBe(1)
    expect(result[4].getDate()).toBe(5)
  })

  it('generates weekly dates in week scale', () => {
    const start = new Date(2026, 0, 5) // Monday
    const end = new Date(2026, 0, 25) // 3 weeks later
    const result = computeActiveDates(start, end, 'week')
    expect(result.length).toBeGreaterThanOrEqual(3)
  })

  it('generates monthly dates in month scale', () => {
    const start = new Date(2026, 0, 1)
    const end = new Date(2026, 2, 31)
    const result = computeActiveDates(start, end, 'month')
    expect(result).toHaveLength(3) // Jan, Feb, Mar
  })

  it('skips non-working days when hideHolidays is true', () => {
    const start = new Date(2026, 0, 5) // Monday
    const end = new Date(2026, 0, 11) // Sunday
    const isNonWorking = (d: Date) => d.getDay() === 0 || d.getDay() === 6
    const result = computeActiveDates(start, end, 'day', {
      hideHolidays: true,
      isNonWorkingDay: isNonWorking
    })
    expect(result).toHaveLength(5) // Mon-Fri only
  })
})
