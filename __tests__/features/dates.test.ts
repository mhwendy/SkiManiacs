import { describe, expect, it } from '@jest/globals';
import { fromIsoDate, toIsoDate } from '@/components/dates';

describe('date helpers', () => {
  it('round-trips local dates', () => {
    expect(toIsoDate(new Date(2027, 0, 5))).toBe('2027-01-05');
    expect(toIsoDate(fromIsoDate('2027-12-31')!)).toBe('2027-12-31');
  });

  it('rejects invalid values', () => {
    expect(fromIsoDate('')).toBeNull();
    expect(fromIsoDate('2027-02-30')).toBeNull();
    expect(fromIsoDate('5/1/2027')).toBeNull();
  });
});
