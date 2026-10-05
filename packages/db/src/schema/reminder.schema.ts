import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./common.js";
import { organizations } from "./organization.schema.js";
import { obligations } from "./obligation.schema.js";

export const reminders = pgTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    obligationId: text("obligation_id")
      .notNull()
      .references(() => obligations.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // email | in_app | ics | telegram | whatsapp | sms
    offsetDays: integer("offset_days").notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    state: text("state").notNull().default("pending"), // pending | sending | sent | failed | dead
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("reminders_obligation_channel_offset_unique").on(
      table.obligationId,
      table.channel,
      table.offsetDays,
    ),
    index("reminders_state_send_at_idx").on(table.state, table.sendAt),
    index("reminders_organization_idx").on(table.organizationId),
  ],
);

export const deliveryLog = pgTable(
  "delivery_log",
  {
    id: text("id").primaryKey(),
    reminderId: text("reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    attemptAt: timestamp("attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    result: text("result").notNull(), // success | failure
    providerId: text("provider_id"),
    error: text("error"),
    ...timestamps,
  },
  (table) => [index("delivery_log_reminder_idx").on(table.reminderId)],
);
