/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { formatDefaultGroupName, formatFullDateTime, getTimeSafe, sortGroupsByDateDesc } from '../../utils/date';

describe('Date Formatting Utilities', () => {
  it('should format full date and time properly', () => {
    const testDate = new Date('2026-10-02T12:30:00Z');
    const result = formatFullDateTime(testDate);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Should include year
    expect(result).toContain('2026');
  });

  it('should handle date string and timestamp inputs', () => {
    const dateStr = '2026-05-15T08:00:00Z';
    const timestamp = new Date(dateStr).getTime();

    expect(formatFullDateTime(dateStr)).toBe(formatFullDateTime(timestamp));
  });

  it('should return empty string for invalid date inputs', () => {
    expect(formatFullDateTime('invalid-date-string')).toBe('');
  });

  it('should format default group name correctly', () => {
    const testDate = new Date('2026-10-02T18:40:00Z');
    const result = formatDefaultGroupName(testDate);

    expect(result.startsWith('Tab Group ·')).toBe(true);
  });

  it('getTimeSafe should safely return milliseconds or 0 for invalid inputs', () => {
    const now = new Date();
    expect(getTimeSafe(now)).toBe(now.getTime());
    expect(getTimeSafe('2026-10-02T12:00:00Z')).toBe(new Date('2026-10-02T12:00:00Z').getTime());
    expect(getTimeSafe(1234567890)).toBe(1234567890);
    expect(getTimeSafe(undefined)).toBe(0);
    expect(getTimeSafe(null)).toBe(0);
    expect(getTimeSafe('invalid-date')).toBe(0);
    expect(getTimeSafe(new Date('invalid'))).toBe(0);
  });

  it('sortGroupsByDateDesc should sort newest first without mutating original array', () => {
    const group1 = { id: '1', name: 'older', createdAt: new Date('2026-10-02T10:00:00Z') };
    const group2 = { id: '2', name: 'newest', createdAt: new Date('2026-10-02T12:00:00Z') };
    const group3 = { id: '3', name: 'middle', createdAt: new Date('2026-10-02T11:00:00Z') };
    const original = [group1, group2, group3];

    const sorted = sortGroupsByDateDesc(original);

    expect(sorted.map((g) => g.id)).toEqual(['2', '3', '1']);
    // Original array must not be mutated
    expect(original.map((g) => g.id)).toEqual(['1', '2', '3']);
  });

  it('sortGroupsByDateDesc should safely handle string createdAt and invalid dates', () => {
    const g1 = { id: '1', createdAt: '2026-10-02T08:00:00Z' };
    const g2 = { id: '2', createdAt: 'invalid' };
    const g3 = { id: '3', createdAt: '2026-10-02T09:00:00Z' };

    const sorted = sortGroupsByDateDesc([g1, g2, g3]);

    expect(sorted[0].id).toBe('3');
    expect(sorted[1].id).toBe('1');
    expect(sorted[2].id).toBe('2');
  });
});
