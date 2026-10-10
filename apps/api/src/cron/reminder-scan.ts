/**
 * Neon Function: Hourly Statutory Reminder Scanner
 * Cron Schedule: 0 * * * * (Hourly at minute 0, UTC)
 *
 * This function is triggered by Neon Function Triggers to scan pending
 * statutory compliance reminders and dispatch alerts via Resend.
 */
export default async function handler(request: Request): Promise<Response> {
  const apiBaseUrl =
    process.env.APP_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
  const cronSecret = process.env.CRON_SECRET || '';

  try {
    const res = await fetch(`${apiBaseUrl}/api/reminders/scan`, {
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
      JSON.stringify({ error: 'Failed to invoke reminder scan', details: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
