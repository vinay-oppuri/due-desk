import {
  addDays,
  formatDate,
  getDaysInMonth,
  shiftToNextWorkingDay,
} from "./calendar.js";
import type {
  ComplianceRule,
  EventContext,
  Holiday,
  RuleOverride,
} from "./types.js";

/**
 * Parses a period string (monthly, quarterly, annual) into base year and month.
 */
function parsePeriodToDateContext(
  period: string,
  frequency: string,
): { year: number; month: number } {
  // 1. Monthly: "YYYY-MM" (e.g. "2026-04")
  const monthlyMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthlyMatch && monthlyMatch[1] && monthlyMatch[2]) {
    return {
      year: parseInt(monthlyMatch[1], 10),
      month: parseInt(monthlyMatch[2], 10),
    };
  }

  // 2. Quarterly: "YYYY-Q1" or "YYYY-Q[1-4]" (Indian Financial Year standard: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar)
  const quarterlyMatch = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarterlyMatch && quarterlyMatch[1] && quarterlyMatch[2]) {
    const startYear = parseInt(quarterlyMatch[1], 10);
    const quarter = parseInt(quarterlyMatch[2], 10);
    switch (quarter) {
      case 1: // Apr - Jun
        return { year: startYear, month: 6 };
      case 2: // Jul - Sep
        return { year: startYear, month: 9 };
      case 3: // Oct - Dec
        return { year: startYear, month: 12 };
      case 4: // Jan - Mar
        return { year: startYear + 1, month: 3 };
    }
  }

  // 3. Financial Year: "2025-26" or "2025-2026"
  const fyMatch = period.match(/^(\d{4})-(\d{2,4})$/);
  if (fyMatch && fyMatch[1] && fyMatch[2]) {
    const endYear =
      fyMatch[2].length === 2
        ? parseInt(fyMatch[1].slice(0, 2) + fyMatch[2], 10)
        : parseInt(fyMatch[2], 10);
    return { year: endYear, month: 3 };
  }

  // 4. Single year: "2026"
  const yearMatch = period.match(/^(\d{4})$/);
  if (yearMatch && yearMatch[1]) {
    return { year: parseInt(yearMatch[1], 10), month: 12 };
  }

  throw new Error(
    `Unsupported period format: "${period}" for frequency: ${frequency}`,
  );
}

/**
 * Computes the raw statutory due date before overrides and holiday shifts.
 */
export function computeRawDueDate(
  rule: ComplianceRule,
  period: string,
  eventContext: EventContext = {},
): string {
  const formula = rule.dueFormula;

  switch (formula.type) {
    case "fixed_day_next_month": {
      const { year, month } = parsePeriodToDateContext(period, rule.frequency);
      let targetYear = year;
      let targetMonth = month + 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }

      // Handle March return exception for TDS (March return due in April 30th instead of 7th)
      let day = formula.day;
      if (month === 3 && formula.marchExceptionDay) {
        day = formula.marchExceptionDay;
      }

      const maxDays = getDaysInMonth(targetYear, targetMonth);
      const clampedDay = Math.min(day, maxDays);
      return formatDate(targetYear, targetMonth, clampedDay);
    }

    case "fixed_day_same_month": {
      const { year, month } = parsePeriodToDateContext(period, rule.frequency);
      const maxDays = getDaysInMonth(year, month);
      const clampedDay = Math.min(formula.day, maxDays);
      return formatDate(year, month, clampedDay);
    }

    case "last_day_next_month": {
      const { year, month } = parsePeriodToDateContext(period, rule.frequency);
      let targetYear = year;
      let targetMonth = month + 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
      const maxDays = getDaysInMonth(targetYear, targetMonth);
      return formatDate(targetYear, targetMonth, maxDays);
    }

    case "quarterly_offset": {
      const { year, month } = parsePeriodToDateContext(period, "quarterly");
      const isQ4 = month === 3;

      const offset =
        isQ4 && formula.q4MonthOffset != null
          ? formula.q4MonthOffset
          : formula.monthOffset;
      const targetDay =
        isQ4 && formula.q4Day != null ? formula.q4Day : formula.day;

      let targetMonth = month + offset;
      let targetYear = year;
      while (targetMonth > 12) {
        targetMonth -= 12;
        targetYear += 1;
      }

      const maxDays = getDaysInMonth(targetYear, targetMonth);
      const clampedDay = Math.min(targetDay, maxDays);
      return formatDate(targetYear, targetMonth, clampedDay);
    }

    case "annual_fixed_date": {
      const { year } = parsePeriodToDateContext(period, "annual");
      const maxDays = getDaysInMonth(year, formula.month);
      const clampedDay = Math.min(formula.day, maxDays);
      return formatDate(year, formula.month, clampedDay);
    }

    case "days_after_event": {
      const eventKey = formula.event.toLowerCase();
      let eventDate: string | undefined;

      if (eventKey === "agm") {
        eventDate = eventContext.agmDate;
      } else if (eventKey === "incorporation") {
        eventDate = eventContext.incorporationDate;
      } else {
        eventDate = eventContext[formula.event];
      }

      if (!eventDate) {
        throw new Error(
          `Event date for "${formula.event}" is required to compute due date for rule ${rule.formCode} (${period}).`,
        );
      }

      return addDays(eventDate, formula.days);
    }

    default:
      throw new Error(`Unsupported due formula type: ${(formula as any).type}`);
  }
}

/**
 * Checks if a government extension override applies to this rule, period, and state.
 */
function findApplicableOverride(
  ruleId: string,
  period: string,
  state: string,
  overrides: RuleOverride[],
): RuleOverride | undefined {
  return overrides.find((o) => {
    if (o.ruleId !== ruleId || o.periodLabel !== period) {
      return false;
    }
    if (
      o.appliesTo?.state &&
      o.appliesTo.state !== state &&
      o.appliesTo.state !== "ALL"
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Pure function: Computes the definitive due date for a compliance rule.
 * 1. Computes statutory raw date from dueFormula.
 * 2. Applies government extension overrides if present.
 * 3. Shifts to next working day if rule has shiftOnHoliday = "next_working_day".
 */
export function computeDueDate(
  rule: ComplianceRule,
  period: string,
  holidays: Holiday[] = [],
  overrides: RuleOverride[] = [],
  eventContext: EventContext = {},
  state = "ALL",
): string {
  // Step 1: Raw statutory date
  const rawDate = computeRawDueDate(rule, period, eventContext);

  // Step 2: Government extension overrides applied BEFORE holiday shifting
  const override = findApplicableOverride(rule.id, period, state, overrides);
  const baseDate = override ? override.newDueDate : rawDate;

  // Step 3: Holiday & weekend shifting
  if (rule.shiftOnHoliday === "next_working_day") {
    return shiftToNextWorkingDay(baseDate, state, holidays);
  }

  return baseDate;
}
