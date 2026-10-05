import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { timestamps } from "./common.js";

export const complianceRules = pgTable(
  "compliance_rules",
  {
    id: text("id").primaryKey(),
    formCode: text("form_code").notNull(),
    name: text("name").notNull(),
    frequency: text("frequency").notNull(), // monthly | quarterly | annual | event_based
    dueFormula: jsonb("due_formula").$type<Record<string, any>>().notNull(),
    shiftOnHoliday: text("shift_on_holiday")
      .notNull()
      .default("next_working_day"), // next_working_day | none
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    version: integer("version").notNull().default(1),
    sourceUrl: text("source_url").notNull(),
    verified: boolean("verified").notNull().default(false),
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("compliance_rules_form_code_idx").on(table.formCode)],
);

export const ruleConditions = pgTable(
  "rule_conditions",
  {
    id: text("id").primaryKey(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => complianceRules.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    operator: text("operator").notNull(),
    value: text("value").notNull(),
    ...timestamps,
  },
  (table) => [index("rule_conditions_rule_id_idx").on(table.ruleId)],
);

export const ruleOverrides = pgTable(
  "rule_overrides",
  {
    id: text("id").primaryKey(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => complianceRules.id, { onDelete: "cascade" }),
    appliesTo: jsonb("applies_to").$type<Record<string, any>>(),
    periodLabel: text("period_label").notNull(),
    newDueDate: date("new_due_date").notNull(),
    sourceUrl: text("source_url").notNull(),
    createdBy: text("created_by"),
    ...timestamps,
  },
  (table) => [
    index("rule_overrides_rule_period_idx").on(table.ruleId, table.periodLabel),
  ],
);

export const ruleAuditLog = pgTable(
  "rule_audit_log",
  {
    id: text("id").primaryKey(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => complianceRules.id, { onDelete: "cascade" }),
    changedBy: text("changed_by").notNull(),
    change: text("change").notNull(),
    reason: text("reason").notNull(),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [index("rule_audit_log_rule_idx").on(table.ruleId)],
);
