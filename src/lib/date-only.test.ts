import { afterEach, describe, expect, it } from 'vitest';
import {
  addDaysToDateOnly,
  compareDateOnly,
  differenceFromTodayInDateOnlyDays,
  differenceInDateOnlyDays,
  formatDateOnly,
  getDateOnlyRelativeState,
  getFullYearsSinceDateOnly,
  parseDateOnly,
  toDateOnlyString,
  toUTCDateFromDateOnly,
} from './date-only';

const originalTimeZone = process.env.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTimeZone;
  }
});

describe('date-only utilities', () => {
  it('parses valid date-only values', () => {
    expect(parseDateOnly('2025-04-15')).toEqual({ year: 2025, month: 4, day: 15 });
  });

  it('rejects invalid date-only values', () => {
    expect(() => parseDateOnly('2025-02-30')).toThrow(/invalid calendar date/i);
  });

  it('formats date-only values without timezone drift in America/Los_Angeles', () => {
    process.env.TZ = 'America/Los_Angeles';

    expect(new Date('2025-04-15').toLocaleDateString('en-US')).toBe('4/14/2025');
    expect(formatDateOnly('2025-04-15', 'en-US')).toBe('4/15/2025');
  });

  it('formats date-only values correctly in a positive-offset timezone', () => {
    process.env.TZ = 'Australia/Sydney';

    expect(formatDateOnly('2025-04-15', 'en-US')).toBe('4/15/2025');
    expect(formatDateOnly('2025-04-15', 'en-AU')).toBe('15/04/2025');
  });

  it('formats date-only values correctly in another non-UTC timezone', () => {
    process.env.TZ = 'America/New_York';

    expect(formatDateOnly('2025-04-15', 'en-US')).toBe('4/15/2025');
  });

  it('derives today date-only for an explicit timezone', () => {
    const now = new Date('2025-04-15T01:00:00Z');

    expect(toDateOnlyString(now, 'America/Los_Angeles')).toBe('2025-04-14');
    expect(toDateOnlyString(now, 'Australia/Sydney')).toBe('2025-04-15');
  });

  it('compares and diffs date-only values by calendar day', () => {
    expect(compareDateOnly('2025-04-15', '2025-04-14')).toBeGreaterThan(0);
    expect(differenceInDateOnlyDays('2025-04-15', '2025-04-10')).toBe(5);
  });

  it('adds days to a date-only value without timestamp parsing', () => {
    expect(addDaysToDateOnly('2025-04-15', 5)).toBe('2025-04-20');
  });

  it('creates a UTC date object from a date-only string', () => {
    const utcDate = toUTCDateFromDateOnly('2025-04-15');

    expect(utcDate.toISOString()).toBe('2025-04-15T00:00:00.000Z');
  });

  it('calculates full years since a date-only hire date', () => {
    const referenceDate = new Date('2025-04-14T23:00:00Z');

    expect(getFullYearsSinceDateOnly('2020-04-15', referenceDate, 'UTC')).toBe(4);
    expect(getFullYearsSinceDateOnly('2020-04-15', referenceDate, 'Australia/Sydney')).toBe(5);
  });

  it('derives relative state and day offsets from today without negative timezone drift', () => {
    const referenceDate = new Date('2025-04-15T01:00:00Z');

    expect(getDateOnlyRelativeState('2025-04-15', referenceDate, 'America/Los_Angeles')).toBe('future');
    expect(differenceFromTodayInDateOnlyDays('2025-04-15', referenceDate, 'America/Los_Angeles')).toBe(1);
    expect(getDateOnlyRelativeState('2025-04-15', referenceDate, 'Australia/Sydney')).toBe('today');
  });
});
