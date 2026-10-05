import { env } from "@repo/env";
import { Resend } from "resend";

export interface SendOtpOptions {
  email: string;
  otp: string;
  type: string;
}

const lastSentOtps = new Map<string, string>();

export function getLatestOtpForTesting(email: string): string | undefined {
  return lastSentOtps.get(email.toLowerCase());
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Sends a 6-digit OTP code to the user's email address via Resend SDK.
 * In development or when RESEND_API_KEY is not configured, logs the code clearly to stdout.
 */
export async function sendOtpEmail({
  email,
  otp,
  type,
}: SendOtpOptions): Promise<void> {
  lastSentOtps.set(email.toLowerCase(), otp);
  const isDevelopment =
    env.NODE_ENV === "development" || env.NODE_ENV === "test";

  console.log(`\n======================================================`);
  console.log(`🔐 [AUTH OTP] Verification Code for ${email}`);
  console.log(`👉 Code: ${otp} (Type: ${type}, Expires in 5 minutes)`);
  console.log(`======================================================\n`);

  if (
    !env.RESEND_API_KEY ||
    env.RESEND_API_KEY.includes("your-resend-key") ||
    env.RESEND_API_KEY === "" ||
    !resend
  ) {
    if (!isDevelopment) {
      console.warn(
        "[Auth Email] RESEND_API_KEY is missing. OTP was not sent via email provider.",
      );
    }
    return;
  }

  const subject =
    type === "sign-in"
      ? `${otp} is your DueDesk verification code`
      : `${otp} - Verify your email address`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px; color: #111827; }
          .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
          .description { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
          .otp-card { background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px; }
          .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0284c7; }
          .footer { font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Compliance Tracker</div>
          <div class="description">Use this one-time code to securely sign in to your compliance dashboard. Never share this code with anyone.</div>
          <div class="otp-card">
            <div class="otp-code">${otp}</div>
          </div>
          <div class="description">This code expires in 5 minutes. If you did not request this login, you can safely ignore this email.</div>
          <div class="footer">
            DueDesk &bull; Statutory Compliance Calendar for Indian Businesses<br>
            Reminder tool, not tax advice.
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error("[Resend SDK Error]:", error);
    }
  } catch (error) {
    console.error("[Resend SDK Request Failed]:", error);
  }
}
