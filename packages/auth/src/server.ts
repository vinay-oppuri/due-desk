import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@repo/db";
import * as schema from "@repo/db/schema";
import { env } from "@repo/env";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  advanced: { database: { joins: true } },
});

export type AuthSession = typeof auth.$Infer.Session;
