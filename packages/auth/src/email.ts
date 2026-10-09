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

export interface SendReminderEmailOptions {
  email: string;
  businessName: string;
  formCode: string;
  ruleName: string;
  dueDate: string;
  offsetDays: number;
  portalUrl?: string;
  checklist?: string[];
}

export interface ReminderEmailResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

type ReminderSendHandler = (options: SendReminderEmailOptions) => Promise<ReminderEmailResult>;
let customReminderSendHandler: ReminderSendHandler | null = null;

export function setReminderSendHandlerForTesting(handler: ReminderSendHandler | null) {
  customReminderSendHandler = handler;
}

/**
 * Sends a statutory compliance deadline reminder email.
 */
export async function sendReminderEmail(
  options: SendReminderEmailOptions,
): Promise<ReminderEmailResult> {
  if (customReminderSendHandler) {
    return customReminderSendHandler(options);
  }

  const { email, businessName, formCode, ruleName, dueDate, offsetDays, portalUrl, checklist } = options;
  const isDevelopment = env.NODE_ENV === "development" || env.NODE_ENV === "test";

  console.log(`\n======================================================`);
  console.log(`🔔 [REMINDER EMAIL] Statutory Deadline Alert`);
  console.log(`👉 To: ${email}`);
  console.log(`👉 Business: ${businessName}`);
  console.log(`👉 Form: ${formCode} - ${ruleName}`);
  console.log(`👉 Due Date: ${dueDate} (${offsetDays} day(s) before due)`);
  console.log(`======================================================\n`);

  if (
    !env.RESEND_API_KEY ||
    env.RESEND_API_KEY.includes("your-resend-key") ||
    env.RESEND_API_KEY === "" ||
    !resend
  ) {
    if (!isDevelopment) {
      console.warn("[Reminder Email] RESEND_API_KEY missing. Reminder logged to stdout.");
    }
    return {
      success: true,
      providerId: `mock_${Date.now()}`,
    };
  }

  const urgencyText =
    offsetDays === 1
      ? "DUE TOMORROW"
      : `DUE IN ${offsetDays} DAYS`;

  const subject = `[${urgencyText}] ${formCode} compliance deadline for ${businessName}`;

  const checklistHtml =
    checklist && checklist.length > 0
      ? `
      <div style="margin-top: 16px; margin-bottom: 20px;">
        <div style="font-weight: 600; font-size: 13px; color: #334155; margin-bottom: 8px;">Required Checklist / Documents:</div>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
          ${checklist.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    `
      : "";

  const portalButtonHtml = portalUrl
    ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${portalUrl}" target="_blank" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 8px; display: inline-block;">
          Go to Official Portal &rarr;
        </a>
      </div>
    `
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; color: #0f172a; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .badge { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 9999px; background-color: ${offsetDays === 1 ? "#fee2e2" : "#fef3c7"}; color: ${offsetDays === 1 ? "#991b1b" : "#92400e"}; margin-bottom: 16px; }
          .header { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
          .sub { font-size: 14px; color: #64748b; margin-bottom: 24px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
          .disclaimer { font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">${urgencyText}</div>
          <div class="header">${formCode} Deadline Reminder</div>
          <div class="sub">This is an automated statutory deadline reminder for <strong>${businessName}</strong>.</div>
          <div class="card">
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">${ruleName}</div>
            <div style="font-size: 14px; color: #64748b; margin-bottom: 16px;">Statutory Due Date: <strong style="color: #0284c7;">${dueDate}</strong></div>
            ${checklistHtml}
            ${portalButtonHtml}
          </div>
          <div class="disclaimer">
            <strong>Statutory Disclaimer:</strong> Reminder tool, not tax advice. Verify dates with the official portal or your CA.<br>
            DueDesk &bull; Compliance Calendar for Indian Businesses
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
      console.error("[Resend Reminder Error]:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      providerId: data?.id,
    };
  } catch (err: any) {
    console.error("[Resend Reminder Request Failed]:", err);
    return {
      success: false,
      error: err?.message || "Unknown email send failure",
    };
  }
}

