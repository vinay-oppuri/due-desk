import { boolean, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps } from "./common.js";
import { organizations } from "./organization.schema.js";

export const businesses = pgTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    state: text("state").notNull(),
    businessType: text("business_type").notNull(),
    turnoverBracket: text("turnover_bracket").notNull(),
    hasEmployees: boolean("has_employees").default(false).notNull(),
    gstin: text("gstin"),
    panLast4: text("pan_last4"),
    registrations: jsonb("registrations").$type<Record<string, any>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [
    index("businesses_organization_id_idx").on(table.organizationId),
  ]
);
