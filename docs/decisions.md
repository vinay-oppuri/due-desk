# Architecture & Implementation Decisions

## ADR 001: Database Schema & Migration Tooling (Phase 1)
- **Date:** 2026-10-04
- **Context:** `AGENTS.md` mandates a multi-tenant schema with strict tenant isolation via Postgres Row Level Security (RLS), custom indexes, and reproducible forward-only migrations.
- **Decision:**
  - Used Drizzle ORM and Drizzle Kit targeting PostgreSQL on Neon Serverless.
  - Migrations are output to root `db/migrations/` as raw ordered SQL files.
  - Migration runner uses `drizzle-orm/neon-http/migrator` over HTTPS to ensure reliable schema application without connection timeouts on serverless environments.
  - Enabled and forced Postgres Row Level Security (`FORCE ROW LEVEL SECURITY`) on all 9 tenant-owned tables (`organizations`, `memberships`, `businesses`, `obligations`, `filings`, `documents`, `reminders`, `subscriptions`, `invoices`).
  - Added `app_user` non-superuser role with `NOBYPASSRLS` for enforcing tenant scoping via `current_setting('app.current_org_id')`.
  - Created idempotent seed loader in `db/seeds/index.ts` with initial state holidays and unverified candidate compliance rules (`verified = false`).
  - Implemented automated cross-tenant isolation test in `packages/db/tests/tenant-isolation.test.ts`.

## ADR 002: Modular Schema File Structure
- **Date:** 2026-10-04
- **Context:** Large monolithic `schema.ts` file becomes difficult to maintain as domain complexity expands across authentication, business profiles, obligations, rules, filings, reminders, and billing.
- **Decision:**
  - Split schemas into domain-specific modules in `packages/db/src/schema/`:
    - `common.ts`: Reusable column definitions (`timestamps`).
    - `user.schema.ts`: Better Auth tables (`user`, `session`, `account`, `verification`).
    - `organization.schema.ts`: Tenancy tables (`organizations`, `memberships`).
    - `business.schema.ts`: `businesses`.
    - `compliance-rule.schema.ts`: `complianceRules`, `ruleConditions`, `ruleOverrides`, `ruleAuditLog`.
    - `holiday.schema.ts`: `holidays`.
    - `obligation.schema.ts`: `obligations`.
    - `filing.schema.ts`: `filings`.
    - `document.schema.ts`: `documents`.
    - `reminder.schema.ts`: `reminders`, `deliveryLog`.
    - `billing.schema.ts`: `subscriptions`, `invoices`.
    - `relations.ts`: Centralized Drizzle table relationships to prevent ESM circular references.
    - `index.ts`: Barrel export of all modular schemas.
  - Retained `packages/db/src/schema.ts` as a transparent re-export of `schema/index.js` to preserve backward compatibility across all consumers.
