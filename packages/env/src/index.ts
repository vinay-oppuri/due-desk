import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

/**
 * Traverses up directory tree from current working directory to find monorepo root.
 */
function findMonorepoRoot(startDir = process.cwd()): string {
  let current = startDir;
  while (current !== dirname(current)) {
    if (
      existsSync(resolve(current, "pnpm-workspace.yaml")) ||
      existsSync(resolve(current, "turbo.json"))
    ) {
      return current;
    }
    current = dirname(current);
  }
  return startDir;
}

// Automatically load root .env if running in Node environment
if (
  typeof process !== "undefined" &&
  typeof process.loadEnvFile === "function"
) {
  const root = findMonorepoRoot();
  const rootEnvPath = resolve(root, ".env");
  if (existsSync(rootEnvPath)) {
    try {
      process.loadEnvFile(rootEnvPath);
    } catch {
      // Ignore if already loaded or permission denied
    }
  }
}

/**
 * Strict schema for all environment variables in Compliance Tracker.
 */
const envSchema = z.object({
  // Runtime
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),

  // Database (Neon Postgres)
  DATABASE_URL: z.string().min(1, {
    message:
      "DATABASE_URL is required to connect to Postgres. Provide it in .env at monorepo root.",
  }),

  // Better Auth
  BETTER_AUTH_SECRET: z
    .string()
    .default("dev-secret-key-at-least-32-chars-long-for-compliance-tracker"),
  BETTER_AUTH_URL: z.string().default("http://localhost:3000"),
  BETTER_AUTH_TRUSTED_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001")
    .transform((val) =>
      val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  // API & Gateway
  API_BASE_URL: z.string().default("http://localhost:4000"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().default("http://localhost:3000"),

  // Email & Resend
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("DueDesk <onboarding@resend.dev>"),

  // OAuth Social Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // Storage & Payments (Future Phases)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

function createEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(
      "\n❌ [ENV VALIDATION ERROR] Invalid or missing environment configuration:\n" +
        errorDetails +
        "\n",
    );
    throw new Error("Invalid environment configuration. Check logs above.");
  }

  return Object.freeze(parsed.data);
}

export const env = createEnv();
export type Env = typeof env;
