/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { formatDefaultGroupName, formatFullDateTime } from '../../utils/date';

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
});
