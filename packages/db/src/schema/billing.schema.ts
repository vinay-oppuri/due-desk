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

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"), // free | standard | pro
    status: text("status").notNull().default("active"), // active | past_due | canceled | grace_period
    razorpayCustomerId: text("razorpay_customer_id"),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("subscriptions_organization_unique").on(table.organizationId),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull(), // paid | unpaid | void
    razorpayInvoiceId: text("razorpay_invoice_id"),
    pdfUrl: text("pdf_url"),
    ...timestamps,
  },
  (table) => [index("invoices_organization_idx").on(table.organizationId)],
);
