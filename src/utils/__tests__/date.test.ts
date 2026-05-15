import { describe, it, expect } from 'vitest';
import {
  parseLocalDate,
  formatLocalDate,
  addDays,
  diffDays,
  startOfWeek,
  startOfMonth,
  diffWeeks,
  diffMonths
} from '../date';

describe('date utils', () => {
  it('parseLocalDate parses date string', () => {
    const result = parseLocalDate('2026-01-15');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(15);
  });

  it('parseLocalDate parses Date object', () => {
    const input = new Date(2026, 5, 10);
    const result = parseLocalDate(input);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(10);
  });

  it('formatLocalDate formats correctly', () => {
    const date = new Date(2026, 0, 15);
    expect(formatLocalDate(date)).toBe('2026-01-15');
  });

  it('addDays adds days correctly', () => {
    const date = new Date(2026, 0, 15);
    const result = addDays(date, 5);
    expect(formatLocalDate(result)).toBe('2026-01-20');
  });

  it('diffDays calculates correctly', () => {
    expect(diffDays('2026-01-01', '2026-01-10')).toBe(9);
  });

  it('startOfWeek returns correct Monday', () => {
    const wed = new Date(2026, 0, 7);
    const mon = startOfWeek(wed, 1);
    expect(formatLocalDate(mon)).toBe('2026-01-05');
  });

  it('startOfMonth returns first day', () => {
    const date = new Date(2026, 0, 15);
    const result = startOfMonth(date);
    expect(formatLocalDate(result)).toBe('2026-01-01');
  });

  it('diffWeeks calculates correctly', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 22);
    expect(diffWeeks(start, end)).toBe(3);
  });

  it('diffMonths calculates correctly', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 3, 1);
    expect(diffMonths(start, end)).toBe(3);
  });
});
