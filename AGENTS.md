<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

Instructions for AI coding agents working on **Compliance Tracker**: a deadline-first compliance calendar for small businesses in India (GST, TDS, PF/ESI, Professional Tax, ROC). Read this whole file before changing anything.

---

## 1. How to use this file (read first)

1. **Audit before building.** For every step, run its `Skip if` check against the actual repo and services. If the check passes, tick the box in the Progress section, write one line of evidence, and move on. Never redo finished work.
2. **Work phase by phase, in order.** Do not start a phase until the previous phase's `Done when` conditions pass (or are ticked).
3. **Prefer what already exists.** If the repo already has a framework, folder layout, ORM, or test runner, keep it and adapt the names in this file. Do not migrate stacks without a human asking.
4. **Human-only steps** (marked `HUMAN`) need accounts, keys, KYC, or legal judgment. Do not fake them. Stop, list exactly what the human must do, and continue with the parts that do not depend on it.
5. **Keep changes small and reviewable.** One concern per commit. Update the Progress section in the same commit as the work.
6. **If unsure, ask.** Especially about tax rules, money, and anything that touches user data.

---

## 2. Product summary

- **Users:** small business owners, freelancers, startups, and CA firms managing many clients.
- **Core promise:** a personalized, accurate calendar of statutory deadlines, with reliable reminders, so users avoid penalties.
- **Not in scope:** filing returns on government portals, storing portal passwords, giving tax advice, any LLM/AI feature inside the product.
- **Disclaimer (must appear in UI and emails):** "Reminder tool, not tax advice. Verify dates with the official portal or your CA."

---

## 3. Hard constraints

| Constraint         | Rule                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Cost               | Zero spend. Use free tiers only. Never add a paid service or a dependency that requires a card. Flag anything that would. |
| No LLM             | No AI/LLM calls anywhere in the running product. Everything is rule-based.                                                |
| Secrets            | Never commit secrets. Provide `.env.example` with names only.                                                             |
| Portal credentials | Never ask for or store GST/Income Tax/MCA portal logins.                                                                  |
| Money              | Payments only via Razorpay hosted checkout and verified webhooks. Never touch card data.                                  |
| Time               | Store timestamps in UTC. Store due dates as `date`. Display in IST. Cron schedules are UTC.                               |
| Idempotency        | Every background job and webhook handler must be safe to run twice.                                                       |
| Rules are data     | Due-date logic lives in database rows with versions, never hardcoded in application code.                                 |
| Tenant isolation   | Every tenant-owned table has `organization_id`, enforced with Postgres row-level security.                                |

---

## 4. Stack (defaults; keep existing choices if already present)

| Concern             | Choice                                                                                                           | Notes                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database            | Neon Postgres (free plan)                                                                                        | Region chosen by human; Singapore was proposed. Free restore window is short, so external backups are required.                                                             |
| Backend / cron      | Neon Functions (Node.js) with Function Triggers                                                                  | Cron is UTC, 5-field. Scheduled calls arrive unauthenticated: keep handlers idempotent. Read the Neon Functions docs before writing handlers; do not guess the handler API. |
| Auth                | Neon Auth (managed Better Auth) or Better Auth in own DB                                                         | Either is acceptable. Pick one in Phase 2 and record it in `docs/decisions.md`.                                                                                             |
| Frontend            | Existing framework if any; otherwise a lightweight SSR/static framework suitable for SEO pages plus an app shell | Hosted on Cloudflare Pages.                                                                                                                                                 |
| Documents           | Cloudflare R2, private bucket, presigned URLs                                                                    | Do **not** use Neon Object Storage for production documents while it is beta. Do **not** use public file URLs.                                                              |
| Email               | Resend (free: 3,000/month, 100/day)                                                                              | Pauses when quota is hit. See budget guard in Phase 5.                                                                                                                      |
| Free extra channels | `.ics` calendar feed, in-app notifications, optional Telegram bot                                                | WhatsApp/SMS are paid per message: paid-plan feature only, built late.                                                                                                      |
| Payments            | Razorpay                                                                                                         | Percentage fee per transaction, no upfront cost.                                                                                                                            |
| Backups             | GitHub Actions weekly `pg_dump` to R2                                                                            | Restore tested quarterly.                                                                                                                                                   |
| Tests               | Whatever exists; otherwise Vitest                                                                                | Rules engine needs the heaviest coverage.                                                                                                                                   |

### Suggested layout (adapt to the repo)

```
/apps/web            frontend + SEO pages
/functions           Neon Functions (reminder scan, webhooks, API)
/packages/rules      pure date/rules engine (no DB, no network)
/db/migrations       SQL migrations (ordered)
/db/seeds            rule seeds (versioned data)
/docs                decisions.md, rules-sources.md, runbook.md
/scripts             backup, usage-check, helpers
```

---

## 5. Domain model (target schema)

Create via migrations; names may be adjusted to existing conventions.

- `organizations(id, name, type: business|ca_firm)`
- `users(id, email, phone)` and `memberships(org_id, user_id, role: owner|accountant|ca|viewer)`
- `businesses(id, org_id, name, state, business_type, turnover_bracket, has_employees, gstin, pan_last4?, registrations jsonb)`
- `compliance_rules(id, form_code, name, frequency, due_formula jsonb, shift_on_holiday, effective_from, effective_to, version, source_url, verified bool, verified_by, verified_at)`
- `rule_conditions(rule_id, field, operator, value)`
- `rule_overrides(id, rule_id, applies_to jsonb, period_label, new_due_date, source_url, created_by)`
- `holidays(state, date, name)`
- `obligations(id, business_id, rule_id, rule_version, period_label, due_date, status: pending|filed|late|not_applicable)` with **unique (business_id, rule_id, period_label)**
- `filings(id, obligation_id, filed_on, filed_by, notes)` (append-only history)
- `documents(id, filing_id, r2_key, checksum, uploaded_by, retain_until)`
- `reminders(id, obligation_id, channel, offset_days, send_at, state: pending|sending|sent|failed|dead, attempts, last_error)` with **unique (obligation_id, channel, offset_days)**
- `delivery_log(id, reminder_id, attempt_at, result, provider_id, error)`
- `subscriptions(id, org_id, plan, status, razorpay_ids...)` and `invoices`
- `rule_audit_log(id, rule_id, changed_by, change, reason, at)`

---

## 6. Progress (agents update this)

Tick when the step's `Skip if` check passes or the work is merged. Add evidence after each tick.

- [x] P0 Baseline and tooling (monorepo build, lint, test, typecheck working across 10 packages; .env.example created with all secret names)
- [x] P1 Database and migrations (19 tables with indexes migrated to Neon via db/migrations, RLS enabled on all 9 tenant tables, db/seeds loaded idempotently, vitest tenant isolation test passed)
- [x] P2 Auth and tenancy (Better Auth in own DB on Neon Postgres, auto-provisioned organization & owner membership on signup, RBAC roles helper with owner/accountant/ca/viewer, SessionGuard with tenant resolution, Postgres RLS via withTenantHttp, apps/api e2e test passing 8/8 tests proving cross-tenant isolation and role enforcement)
- [x] P3 Rules engine and seed data (pure @repo/rules engine implemented with matchRules, computeDueDate, generateObligations; 14/14 vitest tests passing edge cases; 26 candidate rules, 10 holidays, and 10 rule conditions seeded idempotently into Neon)
- [ ] P4 Core app (onboarding, calendar, filing status)
- [ ] P5 Reminder pipeline
- [ ] P6 Document vault
- [ ] P7 Reliability, security, backups, observability
- [ ] P8 Billing and plan gating
- [ ] P9 CA multi-client workspace
- [ ] P10 Launch readiness (SEO, legal, DPDP)

---

## 7. Phases

### P0. Baseline and tooling

**Goal:** a repo that installs, builds, lints, tests, and has documented env vars.

**Skip if:** `package.json` exists, `npm run build` (or equivalent) and the test command succeed, and `.env.example` exists.

Tasks:

1. Audit the repo: framework, package manager, lint/test setup. Write findings to `docs/decisions.md`.
2. Add missing scripts: `build`, `lint`, `test`, `typecheck`.
3. Add `.env.example` listing (names only): `DATABASE_URL`, `RESEND_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `APP_BASE_URL`.
4. Add CI (GitHub Actions) running lint, typecheck, test on pull requests.
5. Add `.gitignore` entries for env files and build output.

Done when: CI is green on an empty change.

`HUMAN`: create the Neon project (Postgres on; Object Storage off; AI Gateway off), Cloudflare account, Resend account, GitHub repo secrets.

---

### P1. Database and migrations

**Goal:** the schema in section 5 exists, with RLS and indexes, reproducible from migrations.

**Skip if:** a migration directory exists and `grep -R "compliance_rules" db/migrations` and `grep -R "ROW LEVEL SECURITY" db/migrations` both match, and migrations apply cleanly to an empty database.

Tasks:

1. Choose a migration tool (keep the existing one). Make migrations forward-only and idempotent to run.
2. Create all tables from section 5 with foreign keys, the two unique constraints noted there, and `created_at/updated_at`.
3. Add indexes: `obligations(organization via business, due_date)`, `obligations(business_id, status)`, `reminders(state, send_at)`.
4. Enable RLS on every tenant-owned table. Policies check membership of the current user's organization. Add a test that a user in org A cannot read org B's rows.
5. Add `db/seeds` loader that is safe to re-run.

Done when: a fresh database migrates, seeds, and the cross-tenant isolation test passes.

---

### P2. Auth and tenancy

**Goal:** sign up, log in, create an organization, invite members with roles.

**Skip if:** login works end to end in a dev environment and `memberships` rows are created on signup.

Tasks:

1. Pick the auth approach and record it in `docs/decisions.md`.
2. Email + password or email OTP login. Short-lived sessions. Rate-limit auth endpoints.
3. On signup create an `organization` and an `owner` membership.
4. Role checks in one shared helper: owner, accountant, ca, viewer. Viewers are read-only.
5. Invite flow by email (respect the email budget in P5).
6. Set the current user/org on each database session so RLS policies apply.

Done when: two users in different orgs cannot see each other's data in an integration test.

---

### P3. Rules engine and seed data

**Goal:** a pure, well-tested engine that turns a business profile into dated obligations.

**Skip if:** `packages/rules` (or equivalent) exists with passing tests for the cases below **and** seeded rules exist in the database.

Tasks:

1. Implement pure functions with no database or network access:
   - `matchRules(profile, rules) -> rules[]`
   - `computeDueDate(rule, period, holidays, overrides) -> date`
   - `generateObligations(profile, rules, holidays, overrides, range) -> obligations[]`
2. Support these `due_formula` shapes (JSON): fixed day of next month; fixed day of same month; quarterly with month offsets; annual fixed date; "N days after event" (for ROC items tied to an AGM date).
3. Support `shift_on_holiday: next_working_day | none`, using the state holiday table plus weekends.
4. Apply `rule_overrides` (government extensions) before holiday shifting, by rule, period, and optionally state.
5. Record `rule_version` on each generated obligation. Regenerating must be idempotent (respect the unique constraint).
6. Tests (required): month-end and leap-year handling, weekend and holiday shifts, quarterly boundaries, an extension override, a rule whose `effective_to` has passed, and idempotent regeneration.
7. Seed the starting rules below as data with `verified = false`.

Starting rule candidates (**unverified, confirm every one against the official source before marking `verified = true`**):

| Area       | Candidate rules to seed                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| GST        | GSTR-1 (monthly and quarterly/QRMP variants), GSTR-3B (monthly and QRMP variants), annual return                                                  |
| TDS        | Monthly TDS/TCS deposit, quarterly TDS returns (24Q/26Q), TDS certificates                                                                        |
| Payroll    | PF monthly payment and return, ESI monthly contribution                                                                                           |
| State      | Professional Tax (monthly or annual depending on state; seed per state, starting with Karnataka, Maharashtra, Tamil Nadu, West Bengal, Telangana) |
| Income tax | Advance tax installments, ITR due dates by assessee type                                                                                          |
| ROC        | AOC-4 and MGT-7 (relative to AGM date), DIR-3 KYC, ADT-1                                                                                          |

Rules for the agent:

- Never present these as authoritative. Every rule needs `source_url`. Leave `verified = false` until a human reviews it.
- Unverified rules must be hidden from paying users or shown with a clear "pending verification" label. Decide and document in `docs/decisions.md`.

`HUMAN`: verify each rule against government notifications; a second person approves (two-person rule). Record in `rule_audit_log`.

Done when: engine tests pass and seed loads at least the starting set.

---

### P4. Core app (onboarding, calendar, filing status)

**Goal:** a user can describe a business and see a correct personal calendar, then track status.

**Skip if:** onboarding, calendar, and status-change screens exist and work against the real database.

Tasks:

1. Onboarding wizard: business type, state, turnover bracket, employees, registrations (GST, PF, ESI, PT). Save to `businesses`.
2. On save, call `generateObligations` and store results.
3. Calendar views: month list and upcoming 30 days. Colour by status (pending, due soon, late, filed). Do not rely on colour alone.
4. Filing detail page: checklist of documents needed, link to the official portal, status change (pending → filed), who changed it and when (append to `filings`).
5. Late handling: mark `late` automatically after the due date if still pending. Show a simple penalty estimator **only** for rules with a verified penalty formula; otherwise show a link to the official page.
6. `.ics` calendar feed per user: private, unguessable token URL, regenerable.
7. Show the disclaimer in the footer and on filing pages.

Done when: a new user can sign up, onboard a sample business, see correct dates for the seeded rules, mark one filed, and subscribe to the `.ics` feed.

---

### P5. Reminder pipeline

**Goal:** reminders are scheduled, sent once, retried safely, and never silently lost.

**Skip if:** an outbox-style `reminders` flow exists, a scheduled Neon Function trigger is deployed (`neon triggers list` shows it), and a send-and-log test passes.

Design (do not change without recording a decision):

- **Outbox in Postgres.** No separate queue service. Reminders are rows with state.
- **Scheduling:** when obligations are generated, insert reminders for offsets 7, 3, and 1 days before due date, per channel, using the unique key `(obligation_id, channel, offset_days)`.
- **Scan function (Neon Function + cron Function Trigger):**
  1. Select reminders where `state = 'pending'` and `send_at <= now()`, using `FOR UPDATE SKIP LOCKED`, in small batches.
  2. Skip and mark done any reminder whose obligation is already `filed`.
  3. Set `sending`, call the channel provider, write `delivery_log`, set `sent` or `failed`.
  4. On failure retry with exponential backoff; after 5 attempts set `dead` and raise an alert.
  5. Optional fallback: if email fails, surface an in-app notification.
- **Cadence:** hourly by default (configurable constant). Do not run every few minutes: it keeps the database awake and burns free compute hours.
- **Security:** scheduled calls are unauthenticated. Reject requests that lack the Neon trigger header, keep the handler idempotent, and never let a request body choose recipients.
- **Email budget guard (Resend free tier: 100/day, 3,000/month):** track sends per day in the database; stop at a safe threshold (e.g. 90/day), send nearest-due first, defer the rest, and alert the operator when usage passes 70%.
- **Watchdog (daily):** verify every obligation due in the next 7 days has its reminders; create any that are missing; alert if it had to repair anything.
- **Free channels first:** email, in-app, `.ics`. Telegram bot is optional. WhatsApp/SMS are **not** implemented until P8 and only for paid plans.

Tasks: implement the above; create the trigger via the Neon CLI/API (UTC cron) and document the exact command in `docs/runbook.md`.

Tests (required): duplicate scan runs send only once; filed obligations are skipped; failure then retry then dead-letter; budget guard defers correctly; watchdog repairs a deleted reminder.

Done when: in a staging environment a reminder for a test obligation arrives once, appears in `delivery_log`, and a forced failure ends in the dead state with an alert.

`HUMAN`: verify the sending domain in Resend (SPF/DKIM) and set the API key.

---

### P6. Document vault

**Goal:** users store filing proofs privately and retrieve them securely.

**Skip if:** uploads go to a private R2 bucket via presigned URLs and downloads use short-lived signed URLs, with a passing authorization test.

Tasks:

1. Private R2 bucket; no public access.
2. Upload flow: API authorizes (role + org), returns a presigned PUT URL (short expiry), client uploads directly, then confirms; store `r2_key`, size, checksum in `documents`.
3. Download flow: authorize, then return a short-lived presigned GET URL.
4. Validate type and size (PDF, PNG, JPG; set a modest max size to protect the free quota).
5. Key layout includes the organization id to prevent cross-tenant guessing.
6. Show per-organization storage usage; block uploads past a plan limit.
7. Deletion removes the object and the row; set `retain_until` for records the user wants kept.

Tests: a user from another organization cannot get a URL; expired URLs fail.

`HUMAN`: create the R2 bucket and API credentials; check whether signup requires a payment method and report it.

---

### P7. Reliability, security, backups, observability

**Goal:** failures are visible, data is recoverable, and abuse is limited.

**Skip if:** each item below is already implemented and documented in `docs/runbook.md`.

Tasks:

1. **Backups:** GitHub Actions weekly `pg_dump` to R2 (encrypted if possible), keep the last several. Add a restore script and document a restore drill; run the drill quarterly.
2. **Usage monitor:** a daily job that reports Resend sends, database compute hours, and R2 storage, and alerts at 70%.
3. **Error tracking and uptime:** use free tiers of an error tracker and an uptime monitor. Add a public status page if free.
4. **Admin page:** list `dead` reminders, failed deliveries, and unverified rules.
5. **Security:** security headers, CSRF protection, rate limiting on auth and upload endpoints, dependency audit in CI, no sensitive data in logs.
6. **Audit trail:** log status changes and rule edits (who, what, when).
7. **Runbook:** how to deploy, roll back, rotate keys, restore a backup, and respond to a wrong-date incident.

Wrong-date incident procedure (document it): fix the rule version, find affected obligations, regenerate, and send a correction notice to affected users.

Done when: a restore drill succeeds into a fresh database and an induced failure produces an alert.

---

### P8. Billing and plan gating

**Goal:** paid plans work and unlock paid-only channels.

**Skip if:** Razorpay checkout, verified webhooks, and plan checks exist and are tested in test mode.

Tasks:

1. Plans (adjust with the human): Free (1 business, email + `.ics`), Standard (more businesses, document vault, WhatsApp/SMS when available), Pro (team access, multi-business).
2. Razorpay hosted checkout and subscriptions; **webhooks are the source of truth**, verified by signature, idempotent by event id.
3. Grace period after a failed renewal so reminders are not cut off right before a deadline.
4. Plan gating in one shared helper, enforced server-side.
5. GST-compliant invoice generation or a clearly documented manual process.
6. Only after revenue covers it: WhatsApp (and SMS if registration is done) as paid-plan channels. Both bill per message, so meter usage and keep the provider behind the same channel interface as email. Check current provider and Meta pricing before building.

`HUMAN`: Razorpay account and KYC, business/GST details, final pricing.

Done when: test-mode payment upgrades a plan, a replayed webhook changes nothing, and gating blocks a Free user from paid features.

---

### P9. CA multi-client workspace

**Goal:** a CA firm manages many client businesses from one login.

**Skip if:** a firm can bulk-add clients and view a cross-client deadline board.

Tasks:

1. Firm organization with many `businesses`; staff members with roles.
2. Bulk import clients from CSV with validation and a dry-run preview.
3. Cross-client board: deadlines this week, overdue items, filter by form, state, assignee.
4. Assign obligations to staff; client-visible status where permitted.
5. Consolidated reminder digest for the firm (one email, not hundreds).
6. Performance: confirm the `(due_date)` and status indexes serve the board with hundreds of clients.

Done when: a test firm with 200 generated clients loads the board quickly and passes tenant-isolation tests.

---

### P10. Launch readiness

**Skip if:** every item is checked in `docs/launch-checklist.md`.

Tasks:

1. SEO pages: "GST due dates this month", "TDS due dates", "ROC filing deadlines" generated from the same rules data, with last-verified dates shown.
2. Legal pages: privacy policy, terms, refund policy, and the not-tax-advice disclaimer.
3. DPDP readiness: consent record at signup, data export, and account deletion that also removes stored documents.
4. Beta label and honest wording: reminders are best-effort; recommend the `.ics` feed as a second safety net. Do not promise uptime.
5. Load test the reminder scan and the calendar pages with realistic data.
6. Final rules review: no unverified rule is shown to paying users.

`HUMAN`: domain purchase and DNS (the only unavoidable cost), legal review, go/no-go.

---

## 8. Definition of done (every change)

- Tests added or updated; CI green.
- No secrets, no PII in logs, no new paid dependency.
- Migrations are reversible or have a documented rollback.
- Progress section and `docs/decisions.md` updated.
- Any new background job is idempotent and has a failure alert.

## 9. Things to never do

- Hardcode a due date or penalty in application code.
- Send a reminder without a unique key and a delivery log row.
- Expose a document through a public URL.
- Skip RLS "just for now".
- Mark a rule `verified` without human approval.
- Add an LLM or any paid service without explicit human approval.
