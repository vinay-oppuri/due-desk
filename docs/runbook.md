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
