import { date, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps } from "./common.js";

export const holidays = pgTable(
  "holidays",
  {
    id: text("id").primaryKey(),
    state: text("state").notNull().default("ALL"),
    date: date("date").notNull(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("holidays_state_date_unique").on(table.state, table.date),
    index("holidays_date_idx").on(table.date),
  ]
);
