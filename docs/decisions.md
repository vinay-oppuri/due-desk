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

## ADR 003: Neon Managed Better Auth Client & Web Integration
- **Date:** 2026-10-04
- **Context:** Neon provides a managed Better Auth engine storing sessions and users in the `neon_auth` PostgreSQL schema. `apps/web` needs authentication without CORS or third-party cookie blocking issues.
- **Decision:**
  - Implemented an internal Next.js proxy route at `app/api/auth/[...all]/route.ts` that transparently forwards requests to `NEON_AUTH_BASE_URL` (`https://ep-misty-breeze-azio0pnv.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth`).
  - Configured header sanitization (`x-forwarded-proto`, `host`) to prevent unnecessary HTTPS redirect loops on localhost while maintaining origin validation.
  - Initialized `authClient` in `apps/web/lib/auth-client.ts` pointing to the first-party origin (`/api/auth`), ensuring session cookies (`better-auth.session_token`) are first-party and preserved across navigation.
  - Implemented a rich, responsive authentication UI at `apps/web/app/auth/page.tsx` supporting Sign In, Sign Up, quick-fill sample user, and real-time session status.

## ADR 004: Unified Better Auth in Own DB & Same-Origin Data Fetching Architecture
- **Date:** 2026-10-04
- **Context:** Phase 2 requires deciding between Neon Managed Auth vs Better Auth in own DB (Postgres public schema). Managing auth in a separate `neon_auth` schema introduced cross-schema foreign key impedance, external HTTPS round-trip overhead, and prevented NestJS `apps/api` from performing direct low-latency session verification.
- **Decision:**
  - **Auth Provider Selected:** Better Auth in own DB (Neon Postgres `public` schema), managed via `@repo/auth/server`.
  - **Shared Auth Library:** `@repo/auth` is the single source of truth across the monorepo:
    - `@repo/auth/client` consumed by `apps/web` (`authClient`, hooks).
    - `@repo/auth/server` consumed by `apps/web` (`toNextJsHandler`) and `apps/api` (`toNodeHandler`, `SessionGuard`).
  - **Same-Origin API Architecture:**
    - Next.js acts as the unified frontend gateway.
    - `/api/auth/*` handled in-process via Next.js Route Handler (`toNextJsHandler(auth)`).
    - `/api/v1/*` rewritten to NestJS (`http://localhost:4000/api/*`) via `next.config.js` rewrites.
    - Eliminates CORS preflights, ensures first-party `HttpOnly; SameSite=Lax` cookies, and prevents third-party cookie blocking.
  - **Tenant Scoping & RLS:**
    - `SessionGuard` extracts the session in NestJS, identifies user and active organization, and attaches it to `request.authSession`.
    - NestJS queries the database with `SET LOCAL app.current_org_id = :orgId`, enforcing Postgres RLS policies across all tenant data.

## ADR 005: Tenancy Auto-Provisioning, RBAC & Postgres RLS Session Linking (Phase 2)
- **Date:** 2026-10-05
- **Context:** To satisfy Phase 2 constraints in `AGENTS.md`, every signup must auto-provision a tenant organization, assign the user as `owner`, enforce role-based access controls across `owner`, `accountant`, `ca`, and `viewer` (read-only), and scope database queries via Postgres Row Level Security.
- **Decision:**
  - **Signup Tenancy Hook:** Configured Better Auth `databaseHooks.user.create.after` in `@repo/auth/server` to atomically insert an `organizations` record (`org_<uuid>`) and an `owner` record in `memberships` (`mem_<uuid>`).
  - **RBAC Roles Helper:** Implemented `packages/auth/src/roles.ts` exporting hierarchy helpers `hasMinimumRole`, `canWrite`, `canFileObligation`, and `canManageMembers`.
  - **NestJS Auth Guards:**
    - `SessionGuard`: Validates session token, resolves user's membership and active organization (handling optional `x-organization-id` header), and sets `request.organizationId` and `request.userRole`.
    - `RolesGuard` & `@Roles(...)` decorator: Enforces endpoint-level permissions based on membership role.
  - **Postgres RLS Session Linking:** Implemented `withTenantHttp` in `@repo/db` to execute queries inside an atomic transaction batch with `SET LOCAL ROLE app_user` and `SET LOCAL app.current_org_id = :orgId`, guaranteeing strict tenant isolation without connection pool leakage.
  - **Verification:** Verified via `apps/api/test/auth-tenancy.e2e-spec.ts` with 8 passing e2e tests covering auto-provisioning, unauthenticated rejection, cross-tenant isolation, cross-tenant header spoofing rejection (403), and viewer write denial (403).

