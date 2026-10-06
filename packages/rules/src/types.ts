export interface BusinessProfile {
  id: string;
  name: string;
  state: string; // e.g. "KA", "MH", "TS", "DL"
  businessType: string; // "pvt_ltd" | "llp" | "proprietorship" | "partnership" | "individual"
  turnoverBracket: string; // "<40L" | "40L-1.5Cr" | "1.5Cr-5Cr" | ">5Cr"
  hasEmployees: boolean;
  gstin?: string | null;
  panLast4?: string | null;
  registrations?: {
    gst?: boolean;
    qrmp?: boolean;
    pf?: boolean;
    esi?: boolean;
    pt?: boolean;
    taxAudit?: boolean;
    [key: string]: any;
  };
}

export type DueFormula =
  | {
      type: "fixed_day_next_month";
      day: number;
      marchExceptionDay?: number;
    }
  | {
      type: "fixed_day_same_month";
      day: number;
    }
  | {
      type: "quarterly_offset";
      monthOffset: number;
      day: number;
      q4MonthOffset?: number;
      q4Day?: number;
    }
  | {
      type: "annual_fixed_date";
      month: number;
      day: number;
    }
  | {
      type: "last_day_next_month";
    }
  | {
      type: "days_after_event";
      event: string; // e.g. "AGM"
      days: number;
    };

export interface ComplianceRule {
  id: string;
  formCode: string;
  name: string;
  frequency: "monthly" | "quarterly" | "annual" | "event_based";
  dueFormula: DueFormula;
  shiftOnHoliday: "next_working_day" | "none";
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string | null; // YYYY-MM-DD
  version: number;
  sourceUrl: string;
  verified: boolean;
  verifiedBy?: string | null;
  verifiedAt?: Date | string | null;
}

export type ConditionOperator =
  "equals" | "not_equals" | "in" | "not_in" | "exists";

export interface RuleCondition {
  id?: string;
  ruleId: string;
  field: string; // e.g. "registrations.gst", "businessType", "hasEmployees", "state"
  operator: ConditionOperator;
  value: any;
}

export interface RuleOverride {
  id?: string;
  ruleId: string;
  periodLabel: string;
  newDueDate: string; // YYYY-MM-DD
  sourceUrl: string;
  appliesTo?: {
    state?: string;
    businessType?: string;
    [key: string]: any;
  } | null;
  createdBy?: string | null;
}

export interface Holiday {
  id?: string;
  state: string; // "ALL" or state code like "KA", "MH"
  date: string; // YYYY-MM-DD
  name: string;
}

export interface GeneratedObligation {
  businessId: string;
  ruleId: string;
  ruleVersion: number;
  periodLabel: string;
  dueDate: string; // YYYY-MM-DD
  status: "pending";
}

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface EventContext {
  agmDate?: string; // YYYY-MM-DD
  incorporationDate?: string; // YYYY-MM-DD
  [key: string]: string | undefined;
}
