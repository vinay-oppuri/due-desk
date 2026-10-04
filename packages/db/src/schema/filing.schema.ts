import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { timestamps } from "./common.js";
import { organizations } from "./organization.schema.js";
import { obligations } from "./obligation.schema.js";
import { user } from "./user.schema.js";

export const filings = pgTable(
  "filings",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    obligationId: text("obligation_id")
      .notNull()
      .references(() => obligations.id, { onDelete: "cascade" }),
    filedOn: timestamp("filed_on", { withTimezone: true }).notNull(),
    filedBy: text("filed_by").references(() => user.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("filings_obligation_idx").on(table.obligationId),
    index("filings_organization_idx").on(table.organizationId),
  ]
);
