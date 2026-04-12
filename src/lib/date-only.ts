const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateOnlyParts {
  year: number;
  month: number;
  day: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function getFormatterTimeZone(timeZone?: string): string {
  return timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function parseDateOnly(value: string): DateOnlyParts {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid date-only value: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  return { year, month, day };
}

export function formatDateOnly(
  value: string,
  locale?: string | string[],
  options: Intl.DateTimeFormatOptions = {},
): string {
  const utcDate = toUTCDateFromDateOnly(value);
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: 'UTC',
  }).format(utcDate);
}

export function toUTCDateFromDateOnly(value: string): Date {
  const { year, month, day } = parseDateOnly(value);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateOnlyString(date: Date = new Date(), timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: getFormatterTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to derive date-only string from formatter parts');
  }

  return `${year}-${month}-${day}`;
}

export function compareDateOnly(left: string, right: string): number {
  const leftParts = parseDateOnly(left);
  const rightParts = parseDateOnly(right);

  if (leftParts.year !== rightParts.year) {
    return leftParts.year - rightParts.year;
  }
  if (leftParts.month !== rightParts.month) {
    return leftParts.month - rightParts.month;
  }
  return leftParts.day - rightParts.day;
}

export function differenceInDateOnlyDays(left: string, right: string): number {
  const leftParts = parseDateOnly(left);
  const rightParts = parseDateOnly(right);
  const leftTime = Date.UTC(leftParts.year, leftParts.month - 1, leftParts.day);
  const rightTime = Date.UTC(rightParts.year, rightParts.month - 1, rightParts.day);
  return Math.round((leftTime - rightTime) / MS_PER_DAY);
}

export function addDaysToDateOnly(value: string, days: number): string {
  const { year, month, day } = parseDateOnly(value);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return [
    result.getUTCFullYear(),
    pad(result.getUTCMonth() + 1),
    pad(result.getUTCDate()),
  ].join('-');
}

export function getDateOnlyRelativeState(
  value: string,
  referenceDate: Date = new Date(),
  timeZone?: string,
): 'past' | 'today' | 'future' {
  const diff = differenceInDateOnlyDays(value, toDateOnlyString(referenceDate, timeZone));
  if (diff < 0) return 'past';
  if (diff > 0) return 'future';
  return 'today';
}

export function differenceFromTodayInDateOnlyDays(
  value: string,
  referenceDate: Date = new Date(),
  timeZone?: string,
): number {
  return differenceInDateOnlyDays(value, toDateOnlyString(referenceDate, timeZone));
}

export function getFullYearsSinceDateOnly(
  value: string,
  referenceDate: Date = new Date(),
  timeZone?: string,
): number {
  const start = parseDateOnly(value);
  const end = parseDateOnly(toDateOnlyString(referenceDate, timeZone));
  let years = end.year - start.year;

  if (end.month < start.month || (end.month === start.month && end.day < start.day)) {
    years -= 1;
  }

  return years;
}
