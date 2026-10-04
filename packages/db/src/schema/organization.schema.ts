import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps } from "./common.js";
import { user } from "./user.schema.js";

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("business"), // business | ca_firm
  ...timestamps,
});

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("viewer"), // owner | accountant | ca | viewer
    ...timestamps,
  },
  (table) => [
    uniqueIndex("memberships_org_user_unique").on(table.organizationId, table.userId),
    index("memberships_org_id_idx").on(table.organizationId),
    index("memberships_user_id_idx").on(table.userId),
  ]
);
