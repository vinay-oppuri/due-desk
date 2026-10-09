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

## ADR 006: Passwordless Email OTP (Resend) & Social Authentication (Google, GitHub)

- **Date:** 2026-10-05
- **Context:** To improve security, avoid password management overhead, and streamline user onboarding, traditional password authentication was replaced with passwordless Email OTP and social OAuth logins (Google, GitHub).
- **Decision:**
  - **Passwordless Auth:** Disabled `emailAndPassword: { enabled: false }` in `@repo/auth/server`.
  - **Email OTP Plugin:** Integrated Better Auth `emailOTP` plugin configured for 6-digit codes expiring in 5 minutes (300 seconds), utilizing the `verification` table in Postgres.
  - **Resend Delivery & Dev Fallback:** Implemented `sendOtpEmail` in `packages/auth/src/email.ts` utilizing the Resend HTTP API. In local development or when `RESEND_API_KEY` is unset, the code is prominently printed to stdout with a clear header for zero friction.
  - **Social Authentication:** Configured Google and GitHub OAuth providers in Better Auth `socialProviders`, populated conditionally from `@repo/env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`).
  - **Client & UI Integration:**
    - Integrated `emailOTPClient()` into `@repo/auth/client`.
    - Redesigned `apps/web/app/auth/page.tsx` into a modern 2-step OTP entry experience with 6 individual digit input boxes, automatic focus progression, a 60-second resend cooldown timer, and branded Google and GitHub action buttons.
  - **Test Suite Updates:** Updated `apps/api/test/auth-tenancy.e2e-spec.ts` to sign in test users via OTP flow, with all 8 e2e tests passing and confirming cross-tenant isolation and role enforcement.

## ADR 007: Pure Date & Compliance Rules Engine (Phase 3)

- **Date:** 2026-10-06
- **Context:** `AGENTS.md` mandates that all due date and statutory obligation logic lives in a pure computational engine decoupled from databases and network calls, with versioned rules and idempotent generation.
- **Decision:**
  - **New Package:** Created `@repo/rules` in `packages/rules` with zero external runtime dependencies.
  - **Core Pure Functions:**
    - `matchRules(profile, rules, conditions)`: Matches business profiles against compliance rules by checking business type, registrations (GST, QRMP, PF, ESI, PT), employee presence, and state.
    - `computeDueDate(rule, period, holidays, overrides, eventContext, state)`: Evaluates formula shapes, applies government extension overrides first, and then shifts due dates on weekends/holidays if configured.
    - `generateObligations(options)`: Outputs dated, versioned, and de-duplicated statutory obligations (`GeneratedObligation`).
  - **Formula Shapes Supported:**
    - `fixed_day_next_month` (e.g. GSTR-3B on 20th, TDS Challan with March exception on 30th April).
    - `fixed_day_same_month` (e.g. mid-month requirements).
    - `quarterly_offset` (e.g. TDS 24Q/26Q with special Q4 May 31 offset, GSTR-1/3B QRMP).
    - `annual_fixed_date` (e.g. Advance Tax installments, ITR filings, GSTR-9).
    - `last_day_next_month` (e.g. Maharashtra PT).
    - `days_after_event` (e.g. ROC AOC-4 30 days after AGM, MGT-7 60 days after AGM, ADT-1 15 days after AGM).
  - **Holiday & Weekend Shift Rules:**
    - Checks Saturday and Sunday weekends.
    - Matches public holidays by state (`ALL` or matching business's state).
    - Shifts day-by-day until the next working day.
  - **Government Extension Overrides:** Applied prior to holiday shifting to guarantee accurate downstream shifting.
  - **Idempotency & Versioning:** Every generated obligation records `ruleVersion` and enforces unique `(businessId, ruleId, periodLabel)`.
  - **Test Coverage:** 14 unit tests in `packages/rules/tests/rules-engine.test.ts` covering month-end and leap-year boundaries, weekend and holiday shifts, quarterly boundaries, extension overrides, expired rules, and idempotent regeneration.

## ADR 008: Core Application, Onboarding Wizard & Compliance Calendar (Phase 4)

- **Date:** 2026-10-06
- **Context:** Phase 4 requires connecting the rules engine to the live application: onboarding businesses, automatically generating obligations in the database, displaying interactive calendar views, tracking filing status, and providing `.ics` calendar sync feeds.
- **Decision:**
  - **Compliance API Module:** Created `ComplianceModule`, `ComplianceService`, and `ComplianceController` in NestJS `apps/api`:
    - `POST /api/businesses`: Saves business profiles and automatically invokes `@repo/rules` engine to compute and persist obligations into Postgres for the financial year.
    - `GET /api/obligations`: Returns statutory obligations scoped by organization with status badges, dynamic late detection (`isLate`, `isDueSoon`, `daysRemaining`), and filtering by business, month, or status.
    - `GET /api/obligations/:id`: Fetches obligation details including form-specific document checklists, direct official government portal URLs, and historical filing records.
    - `POST /api/obligations/:id/file`: Updates obligation status to `filed` and appends an immutable record into `filings` with user ID, timestamp, and notes.
    - `GET /api/calendar/feed.ics`: Generates standard RFC 5545 `.ics` iCalendar text for syncing deadlines with Google Calendar, Apple Calendar, and Outlook.
  - **Web Frontend (`apps/web`):**
    - Implemented business onboarding wizard at `/onboarding` capturing entity type, state, turnover, employee status, and registrations (GST, QRMP, PF, ESI, PT).
    - Built comprehensive compliance calendar dashboard at `/dashboard` featuring metrics overview (Due Soon, Overdue, Filed), interactive month/30-day views, slide-over document checklist & filing drawer, and `.ics` sync.
    - Ensured statutory disclaimer is prominently placed on all filing views and page footers.
  - **Verification:** Added `apps/api/test/compliance.e2e-spec.ts` with 5 end-to-end tests verifying business creation, obligation queries, detail checklist, filing status transitions, and `.ics` feed generation (13/13 e2e tests passing across all test suites).

## ADR 009: Outbox Pattern, Concurrency Locking & Self-Healing Reminder Pipeline (Phase 5)

- **Date:** 2026-10-06
- **Context:** `AGENTS.md` mandates a resilient, queue-less reminder pipeline stored as database rows with state in Postgres, scheduled triggers via Neon Function Triggers (UTC cron), concurrency safety via `FOR UPDATE SKIP LOCKED`, Resend free tier budget protections, exponential retry backoff, and a daily self-healing watchdog.
- **Decision:**
  - **Database-Driven Outbox:** Reminders live directly in the `reminders` table with states (`pending`, `sending`, `sent`, `failed`, `dead`), eliminating external queue dependencies.
  - **Automated Scheduling on Obligation Generation:** When compliance obligations are created, reminders are automatically bulk-inserted for offsets 7, 3, and 1 days before statutory due dates with unique constraint `(obligation_id, channel, offset_days)`.
  - **Concurrency & Claiming Mechanism:**
    - Used atomic `UPDATE reminders SET state = 'sending' WHERE id IN (SELECT id ... FOR UPDATE SKIP LOCKED)` to safely lock and claim pending reminders. Multiple parallel workers or serverless invocations never process duplicate entries.
  - **Batched Metadata & Recipient Fetching:** Pre-fetches obligation details, business names, rule descriptions, and organization member emails in batched queries with `inArray`, keeping execution fast and serverless-friendly.
  - **Email Budget Guard (Resend Free Tier):**
    - Tracks successful deliveries per day.
    - Safe cap enforced at 90 emails/day (leaving 10 emails for critical auth OTPs).
    - Logs operator alert when daily sends reach 70 emails (70% threshold).
    - Defers reminder dispatches when threshold is reached, prioritizing obligations with nearest deadlines.
  - **Retry Backoff & Dead-Letter Handling:**
    - On failure, schedules retries using exponential backoff (`2^attempts * 15 minutes`).
    - After 5 failed attempts, marks the reminder as `dead`, logs a critical dead-letter alert, and records failure details in `delivery_log`.
  - **Filing Awareness:** If an obligation is marked `filed` prior to reminder transmission, the reminder is marked done/sent and skipped without calling the external email provider.
  - **Self-Healing Daily Watchdog:** Daily audit function scans upcoming obligations due within the next 7 days and automatically restores any missing reminder rows.
  - **Neon Serverless Functions & Trigger Runbook:**
    - Implemented standalone handlers in `/functions/reminder-scan.ts` (hourly `0 * * * *`) and `/functions/watchdog.ts` (daily `0 3 * * *`).
    - Documented operational runbook in `docs/runbook.md` with exact `neon triggers create` commands, incident protocols, and dead-letter handling.
  - **Verification:** Verified with 7 end-to-end tests in `apps/api/test/reminders.e2e-spec.ts` covering automatic scheduling, duplicate scan idempotency, filed obligation skipping, retry-to-dead-letter, watchdog restoration, budget metrics, and organization scoping (20/20 e2e tests passing across all suites).

## ADR 010: Private Cloudflare R2 Document Vault, Presigned URLs & Quota Controls (Phase 6)

- **Date:** 2026-10-09
- **Context:** `AGENTS.md` mandates secure, private storage of statutory filing proofs and challans using Cloudflare R2 with presigned URLs, organization storage limits, tenant isolation, MIME/size validation, and statutory retention locks.
- **Decision:**
  - **Storage Provider & SDK:** Integrated Cloudflare R2 private bucket using `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` via S3-compatible endpoints (`https://<account_id>.r2.cloudflarestorage.com`).
  - **Presigned Direct Upload & Download:**
    - Uploads use short-lived presigned `PUT` URLs (300-second expiry) generated by `POST /api/documents/upload-url`.
    - Downloads use short-lived presigned `GET` URLs (900-second expiry) generated by `GET /api/documents/:id/download-url`.
    - Eliminates passing file bytes through backend servers, minimizing API memory and compute overhead.
  - **Tenant-Isolated Key Layout:**
    - Objects are structured under `orgs/${organizationId}/documents/${documentId}/${sanitizedFileName}`.
    - Prevents cross-tenant guessing or enumeration of storage objects.
  - **Strict Validation & Free Tier Quota Limits:**
    - MIME types restricted to statutory documents: `application/pdf`, `image/png`, `image/jpeg`.
    - Individual file size limited to 10MB (`10 * 1024 * 1024` bytes).
    - Per-organization cumulative storage capped at 100MB (`100 * 1024 * 1024` bytes) to stay safely within R2 free tiers.
    - Added `GET /api/documents/storage` for real-time quota tracking (`usedBytes`, `limitBytes`, `percentUsed`).
  - **Statutory Retention Compliance Lock:**
    - Supported optional `retainUntil` timestamp on documents.
    - Deletion requests on documents with `retainUntil > today` are blocked with 400 Bad Request to guarantee proof retention.
  - **Role-Based Access Control (RBAC):**
    - `owner`, `accountant`, and `ca` roles can generate upload URLs, confirm documents, and delete records.
    - `viewer` role is strictly read-only: permitted to download proofs, but blocked with 403 Forbidden on upload or delete attempts.
  - **Verification:** Verified via `apps/api/test/documents.e2e-spec.ts` with 9 passing e2e tests covering upload URLs, confirmation, downloads, cross-tenant isolation, RBAC viewer protection, MIME/size validation, quota enforcement, retention locks, and deletions (29/29 e2e tests passing across 5 suites).

## ADR 011: Reliability, Security, Encrypted Backups & Zero-Spend Observability (Phase 7)

- **Date:** 2026-10-09
- **Context:** `AGENTS.md` mandates weekly encrypted database backups to Cloudflare R2 with disaster recovery restore drills, daily resource usage monitoring across free tier quotas (Resend, Neon, R2) with 70% operator alerts, an administrative dashboard for dead letter queue inspection/recovery, HTTP security headers, and rate limiting.
- **Decision:**
  - **Automated Encrypted Backups (`.github/workflows/backup.yml`):**
    - Weekly GitHub Actions workflow runs `pg_dump` on Neon PostgreSQL.
    - Encrypts dump archive with OpenSSL AES-256-CBC using PBKDF2 key derivation (`BACKUP_ENCRYPTION_KEY`).
    - Uploads encrypted backup and SHA-256 checksum to Cloudflare R2 under `backups/backup_YYYYMMDD_HHMMSS.sql.enc`.
    - Prunes backups older than 30 days to strictly preserve free storage limits.
  - **Disaster Recovery Restore Script (`scripts/restore.ts`):**
    - Built standalone restore utility supporting dry-run table schema validation (`pnpm restore --file <file> --dry-run`).
    - Decrypts AES-256 archives with PBKDF2 key derivation and restores into any target database (`RESTORE_DATABASE_URL`).
  - **Daily Free-Tier Usage Monitor (`apps/api/src/observability/` & `functions/usage-monitor.ts`):**
    - Audits daily usage across:
      1. Resend email deliveries: Capped at 90/day (out of 100/day free limit). Operator alert at 70% (63 sends).
      2. Neon database storage: Capped at 500MB free tier. Operator alert at 70% (350MB).
      3. Cloudflare R2 storage: Capped at 10GB free tier. Operator alert at 70% (7GB).
    - Triggered daily via Neon Function Trigger at `0 6 * * *` (`POST /api/observability/usage-check`).
  - **Security & Abuse Mitigation:**
    - Integrated `helmet()` middleware in NestJS setting `X-Content-Type-Options: nosniff`, `X-Frame-Options`, and Content Security Policies.
    - Added security headers to `apps/web/next.config.js`.
    - Integrated `@nestjs/throttler` with `ThrottlerGuard` to prevent endpoint abuse.
    - Added automated CI dependency security audit (`pnpm audit --audit-level high`) in `.github/workflows/ci.yml`.
  - **Admin Observability Dashboard (`apps/web/app/admin/page.tsx`):**
    - Visual quota usage progress bars with healthy, warning, and critical states.
    - Dead letter queue (DLQ) table displaying terminal failures with 1-click re-queueing to `pending`.
    - Delivery failure diagnostics table.
    - Unverified statutory rules registry linking to official gazette notices.
  - **Verification:** Verified with 7 passing e2e tests in `apps/api/test/observability.e2e-spec.ts` (36/36 tests passing across all 6 test suites).

## ADR 012: Billing, Plan Gating & Razorpay Webhook Infrastructure (Phase 8)

- **Date:** 2026-10-09
- **Context:** `AGENTS.md` mandates plan gating, zero-spend architecture, Razorpay hosted checkout integration, cryptographic signature verification, event idempotency, statutory invoice logging, and grace period handling.
- **Decision:**
  - **Plan Tiers & Gating Logic (`packages/rules/src/plans.ts`):**
    - `Free`: 1 business, document vault disabled, 1 user, ₹0/month.
    - `Standard`: 5 businesses, 100MB document vault, 5 users, ₹499/month (or ₹4,990/year).
    - `Pro`: Unlimited businesses, 1GB document vault, unlimited users, ₹1,499/month (or ₹14,990/year).
    - Pure rule functions: `canAddBusiness(plan, count)`, `canUseDocumentVault(plan)`, `canAddTeamMember(plan, count)`, `isSubscriptionUsable(status, periodEnd)`.
  - **Server-Side Plan Gating:**
    - `POST /api/businesses`: Evaluates `canAddBusiness` against the organization's active plan. Throws 403 Forbidden with upgrade prompt if limit is reached.
    - `POST /api/documents/upload-url`: Evaluates `canUseDocumentVault`. Throws 403 Forbidden for Free plan users attempting to access cloud proof storage.
  - **Razorpay Hosted Checkout (`POST /api/billing/checkout`):**
    - Returns standardized hosted checkout payload (key ID, order ID, amount in paise, currency `INR`, organization notes) without touching card data.
  - **Cryptographic Webhook Signature & Idempotency (`POST /api/billing/webhook`):**
    - Validates `x-razorpay-signature` using HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET`.
    - Event deduplication using `webhook_events` table: duplicate event IDs return `{ received: true, status: 'already_processed' }` with no state changes.
  - **Lifecycle & Grace Period Handling:**
    - `subscription.authenticated`, `subscription.activated`, and `payment.captured` upgrade organization plan to target tier and refresh `currentPeriodEnd`.
    - `subscription.halted` and `payment.failed` transition the organization to `grace_period` (7 days) without abrupt service interruption.
    - `invoice.paid` records paid invoice records in `invoices` table with amount in INR.
  - **Billing UI (`apps/web/app/billing/page.tsx`):**
    - Displays active plan badge, business usage counter, storage meter, and billing cycle.
    - Interactive plan comparison cards for Free, Standard, and Pro with upgrade buttons and feature checklist.
    - Statutory invoice history table with payment date, invoice ID, and download links.
  - **Verification:** Verified with 10 passing end-to-end tests in `apps/api/test/billing.e2e-spec.ts` (46/46 e2e tests passing across all 7 suites).

## ADR 013: CA Multi-Client Workspace, Bulk CSV Import & Consolidated Digest (Phase 9)

- **Date:** 2026-10-09
- **Context:** CA firms in India manage compliance for dozens to hundreds of business clients. They need a single view of all deadlines, the ability to assign tasks to team members, fast client onboarding via CSV, and a single consolidated digest email instead of hundreds of individual alerts to protect Resend free-tier limits.
- **Decision:**
  - **Data Model Extensions:**
    - Added `assigned_to` column (foreign key to `user.id`, ON DELETE SET NULL) and index `obligations_assigned_to_idx` on `obligations` table.
    - Generated and executed migration `db/migrations/0002_obligations_assigned_to.sql` on Neon Postgres.
  - **Modular Architecture (`apps/api/src/ca-workspace/`):**
    - `ca-import.service.ts`: CSV parser with dry-run validation (verifies business type, Indian state, 15-character GSTIN format, and subscription plan limits before importing). Performs fast batch insertion of clients and obligations.
    - `ca-board.service.ts`: Master cross-client board with summary metrics (`totalClients`, `totalPending`, `dueThisWeek`, `overdueCount`, `filedCount`) and filtering by client, tax form code, state, staff assignee, filing status, and timeframe.
    - `ca-digest.service.ts`: Consolidated weekly digest summarizing all client deadlines due within 7 days into a single email, preserving Resend free-tier quota.
    - `ca-workspace.controller.ts`: Secured REST endpoints (`/api/ca/firm`, `/api/ca/staff`, `/api/ca/clients/import/preview`, `/api/ca/clients/import/confirm`, `/api/ca/board`, `/api/ca/obligations/:id/assign`, `/api/ca/digest/preview`, `/api/ca/digest/send`).
  - **Frontend CA Workspace UI (`apps/web/app/ca-workspace/page.tsx`):**
    - Firm dashboard with summary KPI cards, timeframe filters (All, This Week, This Month, Overdue), and staff assignee filters.
    - Master deadline table with real-time staff assignment dropdowns.
    - CSV Bulk Import modal with dry-run validation error breakdown.
    - Consolidated Weekly Digest preview modal with one-click dispatch.
  - **Verification:** Verified with 9 end-to-end tests in `apps/api/test/ca-workspace.e2e-spec.ts` testing dry-run validation, plan capacity gating, bulk creation, board query and filtering, staff assignment, digest email dispatch, and cross-firm tenant isolation (55/55 e2e tests passing across all 8 suites).

## ADR 014: Architectural Separation of Pre-Login Site (apps/web) and Post-Login Application (apps/app)

- **Date:** 2026-10-09
- **Context:** To ensure clean separation between public marketing, search engine optimization (SEO), authentication, and the authenticated product application, the frontend is split into two distinct Next.js applications:
  1. `apps/web`: Public, pre-login site containing marketing landing pages, live statutory calendar reference guides (GST, TDS, ROC), DPDP-compliant legal pages, and authentication.
  2. `apps/app`: Authenticated workspace containing the compliance calendar dashboard, business onboarding, CA multi-client workspace, billing portal, and admin observability.
- **Decision:**
  - **`apps/web` (Pre-Login Web):**
    - Public landing page (`/`) showcasing core platform features, trust pillars, and live statutory deadline preview table.
    - SEO statutory calendar pages: `/gst-due-dates` (GSTR-1, GSTR-3B, QRMP), `/tds-due-dates` (Challan 281, 24Q, 26Q), and `/roc-filing-deadlines` (AOC-4, MGT-7, DIR-3 KYC).
    - Statutory legal pages: `/privacy` (DPDP Act, 2023), `/terms` (mandatory disclaimer), and `/refund` (7-day money-back guarantee).
    - Authentication (`/auth`): Passwordless email OTP and social login. On successful sign-in, seamlessly redirects the user to `NEXT_PUBLIC_APP_URL/dashboard`.
    - Proxy middleware in `apps/web`: Automatically redirects any legacy visits to `/dashboard`, `/onboarding`, `/ca-workspace`, `/billing`, or `/admin` over to `apps/app`.
  - **`apps/app` (Post-Login App):**
    - Created new dedicated workspace package `app` configured in `pnpm-workspace.yaml` and `turbo.json`.
    - Protected routes: `/dashboard`, `/onboarding`, `/ca-workspace`, `/billing`, and `/admin`.
    - Middleware proxy: Intercepts unauthenticated sessions and redirects visitors to `NEXT_PUBLIC_WEB_URL/auth`.
    - Sign out handler: Revokes Better-Auth session and redirects back to `NEXT_PUBLIC_WEB_URL/auth`.
  - **Environment Configuration:**
    - Updated `packages/env` to include port 3002 in default `BETTER_AUTH_TRUSTED_ORIGINS`, with `NEXT_PUBLIC_APP_URL` default to `http://localhost:3002` and `NEXT_PUBLIC_WEB_URL` default to `http://localhost:3000`.
    - Added `"dev:app": "pnpm --filter app dev"` to root `package.json`.
  - **Verification:**
    - Both applications build successfully (`turbo run build` passed 8/8 tasks across 11 packages).
    - Typecheck passed cleanly (`pnpm check-types`).
    - Unit tests passed (`pnpm test`).

