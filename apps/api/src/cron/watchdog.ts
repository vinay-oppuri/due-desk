/**
 * Neon Function: Daily Statutory Reminder Watchdog
 * Cron Schedule: 0 3 * * * (Daily at 03:00 UTC / 08:30 IST)
 *
 * This function is triggered by Neon Function Triggers to audit upcoming obligations
 * due in the next 7 days and repair any missing reminder entries.
 */
export default async function handler(request: Request): Promise<Response> {
  const apiBaseUrl =
    process.env.APP_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
  const cronSecret = process.env.CRON_SECRET || '';

  try {
    const res = await fetch(`${apiBaseUrl}/api/reminders/watchdog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-neon-function-trigger': 'true',
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
    });

    const body = await res.json();
    return new Response(JSON.stringify(body), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to invoke reminder watchdog', details: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
