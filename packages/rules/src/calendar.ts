import type { Holiday } from "./types.js";

/**
 * Checks if a year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns number of days in a given month (1 = Jan, 12 = Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      throw new Error(`Invalid month: ${month}`);
  }
}

/**
 * Parses YYYY-MM-DD into numbers without timezone shifts.
 */
export function parseDate(dateStr: string): {
  year: number;
  month: number;
  day: number;
} {
  const parts = dateStr.split("-");
  const yearStr = parts[0] ?? "";
  const monthStr = parts[1] ?? "";
  const dayStr = parts[2] ?? "";
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
  }

  return { year, month, day };
}

/**
 * Formats year, month, day into YYYY-MM-DD.
 */
export function formatDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * using UTC to avoid any local timezone offset.
 */
export function getDayOfWeek(dateStr: string): number {
  const { year, month, day } = parseDate(dateStr);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.getUTCDay();
}

/**
 * Checks if a date falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(dateStr: string): boolean {
  const dayOfWeek = getDayOfWeek(dateStr);
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Checks if a date is a gazetted holiday for the state or all-India.
 */
export function isHoliday(
  dateStr: string,
  state: string,
  holidays: Holiday[],
): boolean {
  return holidays.some(
    (h) => h.date === dateStr && (h.state === "ALL" || h.state === state),
  );
}

/**
 * Adds an arbitrary number of days to a date string YYYY-MM-DD.
 */
export function addDays(dateStr: string, daysToAdd: number): string {
  const { year, month, day } = parseDate(dateStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return formatDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

/**
 * Shifts a due date to the next working day if it lands on a weekend or public holiday.
 */
export function shiftToNextWorkingDay(
  dateStr: string,
  state: string,
  holidays: Holiday[],
): string {
  let current = dateStr;
  let iterations = 0;

  // Prevent any infinite loop safeguard (e.g. max 30 consecutive days)
  while (iterations < 30) {
    const weekend = isWeekend(current);
    const holiday = isHoliday(current, state, holidays);

    if (!weekend && !holiday) {
      return current;
    }

    current = addDays(current, 1);
    iterations++;
  }

  return current;
}
