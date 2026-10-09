# DueDesk Operations Runbook

This runbook documents operational procedures, cron trigger configurations, rate limits, and incident resolution protocols for DueDesk Compliance Tracker.

---

## 1. Neon Function Triggers & Scheduled Jobs

DueDesk uses Neon Function Triggers (UTC cron) to drive automated background workflows without running persistent compute daemons.

### 1.1 Hourly Statutory Reminder Scan

Scans pending compliance reminders where `send_at <= now()`, claims them atomically via `FOR UPDATE SKIP LOCKED`, verifies filing status, and sends email reminders via Resend.

- **Schedule:** `0 * * * *` (Hourly, at minute 0 UTC)
- **Target Endpoint:** `POST https://api.duedesk.in/api/reminders/scan`
- **Security Header:** `x-neon-function-trigger: true`

**Neon CLI Command to Create Trigger:**
```bash
neon triggers create \
  --name reminder-scan-hourly \
  --schedule "0 * * * *" \
  --url "https://api.duedesk.in/api/reminders/scan" \
  --header "x-neon-function-trigger: true"
```

### 1.2 Daily Self-Healing Watchdog

Scans all active obligations due within the next 7 days, verifies that required reminder entries (offsets 7, 3, 1 days) exist in Postgres, and repairs any missing records.

- **Schedule:** `0 3 * * *` (Daily at 03:00 UTC / 08:30 IST)
- **Target Endpoint:** `POST https://api.duedesk.in/api/reminders/watchdog`
- **Security Header:** `x-neon-function-trigger: true`

**Neon CLI Command to Create Trigger:**
```bash
neon triggers create \
  --name reminder-watchdog-daily \
  --schedule "0 3 * * *" \
  --url "https://api.duedesk.in/api/reminders/watchdog" \
  --header "x-neon-function-trigger: true"
```

---

## 2. Resend Email Budget Guard & Rate Limits

DueDesk operates strictly within the zero-spend constraint using the free tier of Resend:
- **Resend Free Tier Quota:** 100 emails/day, 3,000 emails/month
- **Safe Daily Cap:** 90 emails/day
- **Operator Alert Threshold:** 70 emails/day (70% usage)

### Behavior when Thresholds are Reached:
1. **At 70 emails sent in a single day:** The system logs an `[OPERATOR ALERT]` warning in stdout/logs to inform administrators that 70% of the daily quota is consumed.
2. **At 90 emails sent in a single day:** The system activates the Budget Guard:
   - Halts further non-essential reminder transmissions for the rest of the calendar day.
   - Preserves remaining quota (10 emails) for critical passwordless login OTPs.
   - Defer remaining statutory reminders to the next scan window, prioritizing obligations with the nearest due dates.

---

## 3. Dead-Letter Queue (DLQ) & Failure Recovery

When a reminder fails to send (e.g. transient network failure or provider downtime):
1. **Exponential Backoff:** Retried up to 5 times with backoff intervals (`2^attempts * 15 minutes` = 30m, 60m, 120m, 240m).
2. **Dead State:** If all 5 attempts fail, the reminder is transitioned to `state = 'dead'` and an `[ALERT: DEAD LETTER]` is logged.

### How to Inspect and Resend Dead Reminders:
Query Postgres for failed/dead records:
```sql
SELECT r.id, r.organization_id, r.obligation_id, r.channel, r.attempts, r.last_error, r.send_at
FROM reminders r
WHERE r.state = 'dead'
ORDER BY r.updated_at DESC;
```

To re-queue a dead reminder after resolving an upstream issue:
```sql
UPDATE reminders
SET state = 'pending', attempts = 0, last_error = NULL, send_at = NOW()
WHERE id = 'rem_target_id';
```

---

## 4. Wrong-Date Incident Procedure

If the government issues a notification extending a tax deadline, or an error is discovered in a seeded compliance rule formula:

1. **Fix the Rule in Database:**
   - Either add an entry to `rule_overrides`:
     ```sql
     INSERT INTO rule_overrides (id, rule_id, period_label, new_due_date, source_url, created_by)
     VALUES ('ovr_gst_ext_apr26', 'rule_gstr3b_monthly', 'April 2026', '2026-04-24', 'https://cbic.gov.in/notif.pdf', 'ops_lead');
     ```
   - Or increment the rule `version` in `compliance_rules` and log to `rule_audit_log`.

2. **Identify Affected Obligations:**
   ```sql
   SELECT o.id, o.organization_id, o.due_date, o.period_label, b.name
   FROM obligations o
   JOIN businesses b ON o.business_id = b.id
   WHERE o.rule_id = 'rule_gstr3b_monthly'
     AND o.period_label = 'April 2026'
     AND o.status != 'filed';
   ```

3. **Update Affected Obligations & Reschedule Reminders:**
   - Update obligation due date in Postgres:
     ```sql
     UPDATE obligations
     SET due_date = '2026-04-24', updated_at = NOW()
     WHERE rule_id = 'rule_gstr3b_monthly'
       AND period_label = 'April 2026'
       AND status != 'filed';
     ```
   - Recompute reminder `send_at` timestamps for offset 7, 3, and 1 days before the new date:
     ```sql
     UPDATE reminders r
     SET send_at = (o.due_date - (r.offset_days || ' days')::interval + time '03:30:00'),
         state = 'pending',
         updated_at = NOW()
     FROM obligations o
     WHERE r.obligation_id = o.id
       AND o.rule_id = 'rule_gstr3b_monthly'
       AND o.period_label = 'April 2026'
       AND o.status != 'filed'
       AND r.state != 'sent';
     ```

4. **Send Correction Notice:**
   - If reminders with incorrect dates were already transmitted to users, send a correction email informing affected business owners of the revised statutory extension.

---

## 5. Automated Backups & Quarterly Restore Drill

DueDesk maintains encrypted database backups in Cloudflare R2 and tests restoration procedures quarterly.

### 5.1 Weekly Backup Workflow
- **Workflow File:** `.github/workflows/backup.yml`
- **Schedule:** Weekly at 02:00 UTC on Sunday (`0 2 * * 0`) or manual trigger (`workflow_dispatch`).
- **Encryption:** AES-256-CBC with PBKDF2 key derivation using `BACKUP_ENCRYPTION_KEY`.
- **Target Storage:** Cloudflare R2 bucket under `backups/backup_YYYYMMDD_HHMMSS.sql.enc`.
- **Retention:** Backups older than 30 days are pruned.

### 5.2 Disaster Recovery & Restore Drill Procedure
To run the restore drill on a test database or recover from a backup archive:

1. **Dry-Run Integrity Validation:**
   ```bash
   pnpm restore --file ./scripts/test_backup.sql --dry-run
   ```
   Validates table structure definitions (`compliance_rules`, `organizations`, `obligations`, `reminders`) without modifying the database.

2. **Restore into a Fresh/Target Database:**
   ```bash
   pnpm restore --file ./backups/backup_20261009.sql.enc --key "$BACKUP_ENCRYPTION_KEY" --target-url "$RESTORE_DATABASE_URL"
   ```

3. **Verify Table Schema & Integrity:**
   Query the restored database to confirm table counts:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   SELECT COUNT(*) FROM compliance_rules;
   ```

---

## 6. Daily Free-Tier Usage Monitor & 70% Alerting

To ensure zero spend across all infrastructure tiers, the system audits daily usage across:
- **Resend Emails:** Capped at 90/day (out of 100/day free limit). Operator alert at 70% (63 emails).
- **Neon Serverless DB:** Capped at 500MB free limit. Operator alert at 70% (350MB).
- **Cloudflare R2 Storage:** Capped at 10GB free tier. Operator alert at 70% (7GB).

### 6.1 Scheduled Monitor Trigger
- **Schedule:** `0 6 * * *` (Daily at 06:00 UTC / 11:30 IST)
- **Function:** `/functions/usage-monitor.ts`
- **Target Endpoint:** `POST https://api.duedesk.in/api/observability/usage-check`

**Neon CLI Command to Create Usage Trigger:**
```bash
neon triggers create \
  --name usage-monitor-daily \
  --schedule "0 6 * * *" \
  --url "https://api.duedesk.in/api/observability/usage-check" \
  --header "x-neon-function-trigger: true"
```

---

## 7. Admin Observability & Audit Trail

Administrators and compliance managers can monitor system health at `/admin`:
- **Dead Letter Queue:** Displays unrecoverable reminders with error messages and offers 1-click re-queueing to `pending`.
- **Failed Deliveries:** Logs SMTP failures, gateway timeouts, and provider responses.
- **Unverified Rules Registry:** Displays all rules awaiting human two-person verification with direct links to government gazette notifications.
- **Audit Logs:** Append-only logs for filing status updates and statutory rule adjustments.

---

## 8. Secrets Management & Key Rotation

When rotating credentials, update GitHub repository secrets, Cloudflare Pages environment variables, and Neon configuration:

1. **`DATABASE_URL` (Neon Postgres):**
   - In Neon Console, create a new compute role or password.
   - Update `DATABASE_URL` in Cloudflare Pages and GitHub Actions.
   - Retire the old connection password.

2. **`RESEND_API_KEY` (Email Service):**
   - In Resend dashboard, generate a new API Key with "Sending access".
   - Update secret in Cloudflare Pages and GitHub Actions.
   - Revoke the prior key after testing OTP delivery.

3. **`R2_ACCESS_KEY_ID` & `R2_SECRET_ACCESS_KEY` (Cloudflare R2):**
   - In Cloudflare Dashboard > R2 > Manage R2 API Tokens, create a token with Object Read & Write permissions.
   - Update in Cloudflare Pages and GitHub Actions.
   - Delete the old token.

---

## 9. Deployment & Rollback Protocol

### 9.1 Frontend Deployment (Cloudflare Pages)
- Continuous deployment is linked to the `main` branch.
- To roll back a frontend release, navigate to Cloudflare Pages > Deployments and click **Rollback to this deployment**.

### 9.2 API & Serverless Migrations Rollback
- In the event of a breaking migration:
  1. Inspect the migration in `db/migrations/`.
  2. Revert the bad migration or apply a forward-fixing migration:
     ```bash
     pnpm --filter @repo/db db:generate
     pnpm --filter @repo/db db:migrate
     ```
  3. Verify schema state using `pnpm --filter @repo/db db:studio`.
