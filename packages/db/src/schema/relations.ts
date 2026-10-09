import { relations } from "drizzle-orm";
import { user, session, account } from "./user.schema.js";
import { organizations, memberships } from "./organization.schema.js";
import { businesses } from "./business.schema.js";
import {
  complianceRules,
  ruleConditions,
  ruleOverrides,
  ruleAuditLog,
} from "./compliance-rule.schema.js";
import { obligations } from "./obligation.schema.js";
import { filings } from "./filing.schema.js";
import { documents } from "./document.schema.js";
import { reminders, deliveryLog } from "./reminder.schema.js";
import { subscriptions, invoices } from "./billing.schema.js";

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(memberships),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const organizationRelations = relations(
  organizations,
  ({ many, one }) => ({
    memberships: many(memberships),
    businesses: many(businesses),
    obligations: many(obligations),
    subscription: one(subscriptions),
    invoices: many(invoices),
  }),
);

export const membershipRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  user: one(user, {
    fields: [memberships.userId],
    references: [user.id],
  }),
}));

export const businessRelations = relations(businesses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [businesses.organizationId],
    references: [organizations.id],
  }),
  obligations: many(obligations),
}));

export const complianceRuleRelations = relations(
  complianceRules,
  ({ many }) => ({
    conditions: many(ruleConditions),
    overrides: many(ruleOverrides),
    obligations: many(obligations),
    auditLogs: many(ruleAuditLog),
  }),
);

export const obligationRelations = relations(obligations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [obligations.organizationId],
    references: [organizations.id],
  }),
  business: one(businesses, {
    fields: [obligations.businessId],
    references: [businesses.id],
  }),
  rule: one(complianceRules, {
    fields: [obligations.ruleId],
    references: [complianceRules.id],
  }),
  assignee: one(user, {
    fields: [obligations.assignedTo],
    references: [user.id],
  }),
  filings: many(filings),
  reminders: many(reminders),
}));

export const filingRelations = relations(filings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [filings.organizationId],
    references: [organizations.id],
  }),
  obligation: one(obligations, {
    fields: [filings.obligationId],
    references: [obligations.id],
  }),
  user: one(user, {
    fields: [filings.filedBy],
    references: [user.id],
  }),
  documents: many(documents),
}));

export const documentRelations = relations(documents, ({ one }) => ({
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
  filing: one(filings, {
    fields: [documents.filingId],
    references: [filings.id],
  }),
  user: one(user, {
    fields: [documents.uploadedBy],
    references: [user.id],
  }),
}));

export const reminderRelations = relations(reminders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [reminders.organizationId],
    references: [organizations.id],
  }),
  obligation: one(obligations, {
    fields: [reminders.obligationId],
    references: [obligations.id],
  }),
  deliveryLogs: many(deliveryLog),
}));

export const deliveryLogRelations = relations(deliveryLog, ({ one }) => ({
  reminder: one(reminders, {
    fields: [deliveryLog.reminderId],
    references: [reminders.id],
  }),
}));
