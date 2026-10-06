import { describe, expect, it } from "vitest";
import {
  computeDueDate,
  generateObligations,
  getDaysInMonth,
  isLeapYear,
  matchRules,
  shiftToNextWorkingDay,
} from "../src/index.js";
import type {
  BusinessProfile,
  ComplianceRule,
  Holiday,
  RuleCondition,
  RuleOverride,
} from "../src/index.js";

describe("Phase 3: Pure Compliance & Rules Engine (@repo/rules)", () => {
  // Sample business profile
  const sampleBusiness: BusinessProfile = {
    id: "biz_test_123",
    name: "Acme Infotech Pvt Ltd",
    state: "KA",
    businessType: "pvt_ltd",
    turnoverBracket: "1.5Cr-5Cr",
    hasEmployees: true,
    registrations: {
      gst: true,
      pf: true,
      esi: true,
      pt: true,
    },
  };

  // Sample holidays
  const holidays: Holiday[] = [
    { state: "ALL", date: "2026-01-26", name: "Republic Day" }, // Monday
    { state: "ALL", date: "2026-08-15", name: "Independence Day" }, // Saturday
    { state: "ALL", date: "2026-10-02", name: "Gandhi Jayanti" }, // Friday
    { state: "KA", date: "2026-11-01", name: "Kannada Rajyotsava" }, // Sunday
    { state: "KA", date: "2026-03-19", name: "Ugadi" }, // Thursday
    { state: "MH", date: "2026-05-01", name: "Maharashtra Day" }, // Friday
  ];

  describe("1. Month-end & Leap-Year Handling", () => {
    it("correctly identifies leap years", () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2025)).toBe(false);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2028)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1900)).toBe(false);
    });

    it("correctly calculates days in February for leap and non-leap years", () => {
      expect(getDaysInMonth(2024, 2)).toBe(29);
      expect(getDaysInMonth(2025, 2)).toBe(28);
      expect(getDaysInMonth(2026, 2)).toBe(28);
    });

    it("clamps day 31 to 28/29 in February and 30 in April/June/Sept/Nov", () => {
      const endOfMonthRule: ComplianceRule = {
        id: "rule_test_eom",
        formCode: "TEST-EOM",
        name: "Test End of Month",
        frequency: "monthly",
        dueFormula: { type: "last_day_next_month" },
        shiftOnHoliday: "none",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://example.com",
        verified: false,
      };

      // January return due end of February:
      // In 2024 (leap year) -> 2024-02-29
      expect(computeDueDate(endOfMonthRule, "2024-01")).toBe("2024-02-29");
      // In 2026 (non-leap year) -> 2026-02-28
      expect(computeDueDate(endOfMonthRule, "2026-01")).toBe("2026-02-28");

      // March return due end of April (30 days) -> 2026-04-30
      expect(computeDueDate(endOfMonthRule, "2026-03")).toBe("2026-04-30");
    });
  });

  describe("2. Weekend & Holiday Shifts", () => {
    it("shifts due date falling on Saturday to Monday", () => {
      // 2026-06-20 is a Saturday
      const gstr3bRule: ComplianceRule = {
        id: "rule_gstr3b",
        formCode: "GSTR-3B",
        name: "GSTR-3B Monthly Return",
        frequency: "monthly",
        dueFormula: { type: "fixed_day_next_month", day: 20 },
        shiftOnHoliday: "next_working_day",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://gst.gov.in",
        verified: false,
      };

      // May 2026 return: 20th of June 2026 is Saturday -> shifts to Monday 2026-06-22
      const dueDate = computeDueDate(
        gstr3bRule,
        "2026-05",
        holidays,
        [],
        {},
        "KA",
      );
      expect(dueDate).toBe("2026-06-22");
    });

    it("shifts due date falling on Sunday to Monday", () => {
      // 2026-09-20 is a Sunday
      const gstr3bRule: ComplianceRule = {
        id: "rule_gstr3b",
        formCode: "GSTR-3B",
        name: "GSTR-3B Monthly Return",
        frequency: "monthly",
        dueFormula: { type: "fixed_day_next_month", day: 20 },
        shiftOnHoliday: "next_working_day",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://gst.gov.in",
        verified: false,
      };

      // August 2026 return: 20th Sept 2026 is Sunday -> shifts to Monday 2026-09-21
      const dueDate = computeDueDate(
        gstr3bRule,
        "2026-08",
        holidays,
        [],
        {},
        "KA",
      );
      expect(dueDate).toBe("2026-09-21");
    });

    it("shifts when landing on a public holiday (Republic Day)", () => {
      // Republic Day is 2026-01-26 (Monday). Suppose a rule is due on 26th Jan:
      const testRule: ComplianceRule = {
        id: "rule_rep_day",
        formCode: "TEST-REP",
        name: "Test Holiday Rule",
        frequency: "monthly",
        dueFormula: { type: "fixed_day_same_month", day: 26 },
        shiftOnHoliday: "next_working_day",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://example.com",
        verified: false,
      };

      // Monday 26 Jan 2026 is ALL-India holiday -> shifts to Tuesday 2026-01-27
      const dueDate = computeDueDate(
        testRule,
        "2026-01",
        holidays,
        [],
        {},
        "KA",
      );
      expect(dueDate).toBe("2026-01-27");
    });

    it("applies state-specific holiday only to businesses in that state", () => {
      // Ugadi on 2026-03-19 is a holiday in KA, but NOT in MH
      const testRule: ComplianceRule = {
        id: "rule_state_hol",
        formCode: "TEST-STATE-HOL",
        name: "Test State Holiday",
        frequency: "monthly",
        dueFormula: { type: "fixed_day_same_month", day: 19 },
        shiftOnHoliday: "next_working_day",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://example.com",
        verified: false,
      };

      // For KA business: 2026-03-19 is Ugadi -> shifts to Friday 2026-03-20
      const dueDateKA = computeDueDate(
        testRule,
        "2026-03",
        holidays,
        [],
        {},
        "KA",
      );
      expect(dueDateKA).toBe("2026-03-20");

      // For MH business: 2026-03-19 is a regular working Thursday -> stays 2026-03-19
      const dueDateMH = computeDueDate(
        testRule,
        "2026-03",
        holidays,
        [],
        {},
        "MH",
      );
      expect(dueDateMH).toBe("2026-03-19");
    });
  });

  describe("3. Quarterly Boundaries & Formula Shapes", () => {
    it("handles quarterly TDS returns with Q4 month offset extension", () => {
      const tds26QRule: ComplianceRule = {
        id: "rule_tds_26q",
        formCode: "FORM-26Q",
        name: "Quarterly TDS Return (26Q)",
        frequency: "quarterly",
        dueFormula: {
          type: "quarterly_offset",
          monthOffset: 1,
          day: 31,
          q4MonthOffset: 2,
          q4Day: 31,
        },
        shiftOnHoliday: "next_working_day",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://incometax.gov.in",
        verified: false,
      };

      // Q1 (Apr-Jun): Quarter ends June 30. Due 1 month later: July 31 -> 2026-07-31 (Friday)
      expect(
        computeDueDate(tds26QRule, "2026-Q1", holidays, [], {}, "KA"),
      ).toBe("2026-07-31");

      // Q2 (Jul-Sep): Quarter ends Sept 30. Due 1 month later: Oct 31 -> 2026-10-31 is Saturday!
      // Shifts through Sunday Nov 1 (which in KA is also Kannada Rajyotsava holiday!) -> Tuesday Nov 3
      // In Nov 2026: Nov 1 is Sunday. Monday Nov 2 is working day.
      expect(
        computeDueDate(tds26QRule, "2026-Q2", holidays, [], {}, "KA"),
      ).toBe("2026-11-02");

      // Q4 (Jan-Mar): Quarter ends March 31. Has special Q4 offset (2 months) -> May 31!
      // In 2027: 2027-05-31 is Monday -> 2027-05-31
      expect(
        computeDueDate(tds26QRule, "2026-Q4", holidays, [], {}, "KA"),
      ).toBe("2027-05-31");
    });

    it("handles TDS monthly deposit March exception day (April 30 instead of April 7)", () => {
      const tdsChallanRule: ComplianceRule = {
        id: "rule_tds_challan",
        formCode: "CHALLAN-ITNS-281",
        name: "TDS / TCS Monthly Deposit",
        frequency: "monthly",
        dueFormula: {
          type: "fixed_day_next_month",
          day: 7,
          marchExceptionDay: 30,
        },
        shiftOnHoliday: "none",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://incometax.gov.in",
        verified: false,
      };

      // February return: due 7th of next month (March 7, 2026)
      expect(computeDueDate(tdsChallanRule, "2026-02")).toBe("2026-03-07");

      // March return: due April 30th (marchExceptionDay)
      expect(computeDueDate(tdsChallanRule, "2026-03")).toBe("2026-04-30");
    });
  });

  describe("4. Government Extension Overrides", () => {
    it("applies government extension override before holiday shifting", () => {
      const gstr1Rule: ComplianceRule = {
        id: "rule_gstr1",
        formCode: "GSTR-1",
        name: "GSTR-1 Monthly Return",
        frequency: "monthly",
        dueFormula: { type: "fixed_day_next_month", day: 11 },
        shiftOnHoliday: "next_working_day",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://gst.gov.in",
        verified: false,
      };

      // Government extended July return from Aug 11 to Aug 15 (which is Saturday & Independence Day holiday!)
      const overrides: RuleOverride[] = [
        {
          ruleId: "rule_gstr1",
          periodLabel: "2026-07",
          newDueDate: "2026-08-15", // Saturday + Holiday
          sourceUrl: "https://cbic.gov.in/notification-ext-123",
        },
      ];

      // Override sets date to 2026-08-15.
      // 2026-08-15 is Saturday AND Independence Day.
      // Sunday 2026-08-16 is weekend.
      // Therefore, shifts to Monday 2026-08-17!
      const finalDueDate = computeDueDate(
        gstr1Rule,
        "2026-07",
        holidays,
        overrides,
        {},
        "KA",
      );
      expect(finalDueDate).toBe("2026-08-17");
    });
  });

  describe("5. Expired Rule Handling (effective_to passed)", () => {
    it("ignores rules whose effective_to has expired", () => {
      const activeRule: ComplianceRule = {
        id: "rule_active",
        formCode: "ACTIVE-FORM",
        name: "Active Statutory Rule",
        frequency: "monthly",
        dueFormula: { type: "fixed_day_next_month", day: 15 },
        shiftOnHoliday: "none",
        effectiveFrom: "2024-01-01",
        effectiveTo: null,
        version: 1,
        sourceUrl: "https://example.com",
        verified: false,
      };

      const expiredRule: ComplianceRule = {
        id: "rule_expired",
        formCode: "OLD-FORM",
        name: "Discontinued Filing",
        frequency: "monthly",
        dueFormula: { type: "fixed_day_next_month", day: 15 },
        shiftOnHoliday: "none",
        effectiveFrom: "2024-01-01",
        effectiveTo: "2025-12-31", // Expired at end of 2025
        version: 1,
        sourceUrl: "https://example.com",
        verified: false,
      };

      const obligations = generateObligations({
        profile: sampleBusiness,
        rules: [activeRule, expiredRule],
        range: {
          startDate: "2026-04-01",
          endDate: "2026-05-31",
        },
      });

      // Only activeRule should produce obligations for 2026
      expect(obligations.some((o) => o.ruleId === "rule_active")).toBe(true);
      expect(obligations.some((o) => o.ruleId === "rule_expired")).toBe(false);
    });
  });

  describe("6. Event-Based Due Dates (ROC/MCA)", () => {
    it("computes due date N days after AGM event (AOC-4 and MGT-7)", () => {
      const aoc4Rule: ComplianceRule = {
        id: "rule_aoc4",
        formCode: "AOC-4",
        name: "Filing of Financial Statements (AOC-4)",
        frequency: "event_based",
        dueFormula: { type: "days_after_event", event: "AGM", days: 30 },
        shiftOnHoliday: "next_working_day",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://mca.gov.in",
        verified: false,
      };

      const mgt7Rule: ComplianceRule = {
        id: "rule_mgt7",
        formCode: "MGT-7",
        name: "Annual Return (MGT-7)",
        frequency: "event_based",
        dueFormula: { type: "days_after_event", event: "AGM", days: 60 },
        shiftOnHoliday: "next_working_day",
        effectiveFrom: "2024-01-01",
        version: 1,
        sourceUrl: "https://mca.gov.in",
        verified: false,
      };

      // AGM held on 2026-09-30
      const agmDate = "2026-09-30";

      // AOC-4: 30 days after Sept 30 -> Oct 30, 2026 (Friday)
      const aoc4DueDate = computeDueDate(aoc4Rule, "FY-2025-26", holidays, [], {
        agmDate,
      });
      expect(aoc4DueDate).toBe("2026-10-30");

      // MGT-7: 60 days after Sept 30 -> Nov 29, 2026 (Sunday) -> shifts to Monday Nov 30!
      const mgt7DueDate = computeDueDate(mgt7Rule, "FY-2025-26", holidays, [], {
        agmDate,
      });
      expect(mgt7DueDate).toBe("2026-11-30");
    });
  });

  describe("7. Idempotent Regeneration", () => {
    it("generating obligations twice yields identical, deduplicated results", () => {
      const rules: ComplianceRule[] = [
        {
          id: "rule_epf",
          formCode: "EPF-ECR",
          name: "EPF Monthly Payment & Return",
          frequency: "monthly",
          dueFormula: { type: "fixed_day_next_month", day: 15 },
          shiftOnHoliday: "next_working_day",
          effectiveFrom: "2024-01-01",
          version: 2,
          sourceUrl: "https://epfindia.gov.in",
          verified: false,
        },
      ];

      const run1 = generateObligations({
        profile: sampleBusiness,
        rules,
        range: {
          startDate: "2026-04-01",
          endDate: "2026-06-30",
        },
      });

      const run2 = generateObligations({
        profile: sampleBusiness,
        rules,
        range: {
          startDate: "2026-04-01",
          endDate: "2026-06-30",
        },
      });

      expect(run1).toEqual(run2);
      expect(run1.length).toBeGreaterThan(0);

      // Verify rule_version is populated on each obligation
      for (const ob of run1) {
        expect(ob.ruleVersion).toBe(2);
        expect(ob.businessId).toBe(sampleBusiness.id);
        expect(ob.status).toBe("pending");
      }

      // Check unique (businessId, ruleId, periodLabel)
      const keys = run1.map(
        (o) => `${o.businessId}:${o.ruleId}:${o.periodLabel}`,
      );
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });
  });

  describe("8. Profile Matching (matchRules)", () => {
    it("filters rules based on explicit conditions and registration flags", () => {
      const rules: ComplianceRule[] = [
        {
          id: "rule_gst",
          formCode: "GSTR-3B",
          name: "GSTR-3B",
          frequency: "monthly",
          dueFormula: { type: "fixed_day_next_month", day: 20 },
          shiftOnHoliday: "next_working_day",
          effectiveFrom: "2024-01-01",
          version: 1,
          sourceUrl: "https://gst.gov.in",
          verified: false,
        },
        {
          id: "rule_pt_mh",
          formCode: "PT-MH",
          name: "Maharashtra PT",
          frequency: "monthly",
          dueFormula: { type: "last_day_next_month" },
          shiftOnHoliday: "next_working_day",
          effectiveFrom: "2024-01-01",
          version: 1,
          sourceUrl: "https://mahagst.gov.in",
          verified: false,
        },
      ];

      const conditions: RuleCondition[] = [
        {
          ruleId: "rule_gst",
          field: "registrations.gst",
          operator: "equals",
          value: true,
        },
        {
          ruleId: "rule_pt_mh",
          field: "state",
          operator: "equals",
          value: "MH",
        },
      ];

      // sampleBusiness has state: KA, registrations.gst: true
      const matched = matchRules(sampleBusiness, rules, conditions);
      expect(matched.map((r) => r.id)).toContain("rule_gst");
      expect(matched.map((r) => r.id)).not.toContain("rule_pt_mh");
    });
  });
});
