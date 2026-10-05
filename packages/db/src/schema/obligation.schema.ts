import {
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./common.js";
import { organizations } from "./organization.schema.js";
import { businesses } from "./business.schema.js";
import { complianceRules } from "./compliance-rule.schema.js";

export const obligations = pgTable(
  "obligations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    ruleId: text("rule_id")
      .notNull()
      .references(() => complianceRules.id, { onDelete: "restrict" }),
    ruleVersion: integer("rule_version").notNull().default(1),
    periodLabel: text("period_label").notNull(),
    dueDate: date("due_date").notNull(),
    status: text("status").notNull().default("pending"), // pending | filed | late | not_applicable
    ...timestamps,
  },
  (table) => [
    uniqueIndex("obligations_business_rule_period_unique").on(
      table.businessId,
      table.ruleId,
      table.periodLabel,
    ),
    index("obligations_org_due_date_idx").on(
      table.organizationId,
      table.dueDate,
    ),
    index("obligations_business_status_idx").on(table.businessId, table.status),
  ],
);
