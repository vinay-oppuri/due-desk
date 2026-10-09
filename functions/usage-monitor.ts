/**
 * Neon Function: Daily Resource Usage Monitor & Budget Guard
 * Cron Schedule: 0 6 * * * (Daily at 06:00 UTC / 11:30 AM IST)
 *
 * This function triggers the daily usage check across:
 * - Resend email sends (caps at 90/day, alerts at 70%)
 * - Neon database storage (500MB free tier cap, alerts at 70%)
 * - Cloudflare R2 object storage (10GB free tier cap, alerts at 70%)
 */
export default async function handler(request: Request): Promise<Response> {
  const apiBaseUrl =
    process.env.APP_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
  const cronSecret = process.env.CRON_SECRET || '';

  try {
    const res = await fetch(`${apiBaseUrl}/api/observability/usage-check`, {
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
      JSON.stringify({ error: 'Failed to invoke daily usage monitor', details: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
