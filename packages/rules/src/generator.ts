import { computeDueDate } from "./evaluator.js";
import { matchRules } from "./matcher.js";
import { parseDate, formatDate } from "./calendar.js";
import type {
  BusinessProfile,
  ComplianceRule,
  DateRange,
  EventContext,
  GeneratedObligation,
  Holiday,
  RuleCondition,
  RuleOverride,
} from "./types.js";

/**
 * Generates all applicable period labels for a given rule frequency within a date range.
 */
function generatePeriodsForRange(
  frequency: string,
  range: DateRange,
): string[] {
  const start = parseDate(range.startDate);
  const end = parseDate(range.endDate);

  const periods: string[] = [];

  switch (frequency) {
    case "monthly": {
      let curYear = start.year;
      let curMonth = start.month;

      while (
        curYear < end.year ||
        (curYear === end.year && curMonth <= end.month)
      ) {
        periods.push(`${curYear}-${String(curMonth).padStart(2, "0")}`);
        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }
      }
      return periods;
    }

    case "quarterly": {
      // Generate FY quarters intersecting the years (e.g. 2026-Q1, 2026-Q2, 2026-Q3, 2026-Q4)
      for (let y = start.year - 1; y <= end.year; y++) {
        for (let q = 1; q <= 4; q++) {
          periods.push(`${y}-Q${q}`);
        }
      }
      return periods;
    }

    case "annual": {
      for (let y = start.year - 1; y <= end.year; y++) {
        periods.push(`${y}`);
        periods.push(`${y}-${String(y + 1).slice(-2)}`);
      }
      return periods;
    }

    case "event_based": {
      // Event based periods are labeled by the event year
      periods.push(`FY-${start.year}-${String(start.year + 1).slice(-2)}`);
      return periods;
    }

    default:
      return [];
  }
}

/**
 * Options for obligation generation.
 */
export interface GenerateObligationsOptions {
  profile: BusinessProfile;
  rules: ComplianceRule[];
  conditions?: RuleCondition[];
  holidays?: Holiday[];
  overrides?: RuleOverride[];
  range: DateRange;
  eventContext?: EventContext;
}

/**
 * Pure function: Generates all dated statutory obligations for a business profile within a date range.
 * - Matches business against rules (and optional conditions).
 * - Computes due dates with formula evaluation, government extension overrides, and holiday shifting.
 * - Enforces effective date ranges.
 * - Idempotent: produces unique obligations by (businessId, ruleId, periodLabel).
 */
export function generateObligations({
  profile,
  rules,
  conditions = [],
  holidays = [],
  overrides = [],
  range,
  eventContext = {},
}: GenerateObligationsOptions): GeneratedObligation[] {
  // Step 1: Match applicable rules
  const applicableRules = matchRules(profile, rules, conditions);

  // Map to enforce unique (businessId, ruleId, periodLabel)
  const obligationMap = new Map<string, GeneratedObligation>();

  for (const rule of applicableRules) {
    // Generate period candidates for this rule's frequency
    const periods = generatePeriodsForRange(rule.frequency, range);

    for (const period of periods) {
      try {
        const dueDate = computeDueDate(
          rule,
          period,
          holidays,
          overrides,
          eventContext,
          profile.state,
        );

        // Check date range boundary: obligation due date must fall within requested range
        if (dueDate < range.startDate || dueDate > range.endDate) {
          continue;
        }

        // Check rule effectiveness: rule must be effective on due date
        if (dueDate < rule.effectiveFrom) {
          continue;
        }
        if (rule.effectiveTo && dueDate > rule.effectiveTo) {
          continue;
        }

        const uniqueKey = `${profile.id}:${rule.id}:${period}`;
        obligationMap.set(uniqueKey, {
          businessId: profile.id,
          ruleId: rule.id,
          ruleVersion: rule.version,
          periodLabel: period,
          dueDate,
          status: "pending",
        });
      } catch {
        // Skip periods that cannot be computed (e.g. missing optional event dates)
        continue;
      }
    }
  }

  // Sort by due date ascending
  return Array.from(obligationMap.values()).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
}
