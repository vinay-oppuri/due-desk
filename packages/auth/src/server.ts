import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@repo/db";
import * as schema from "@repo/db/schema";
import { betterAuth } from "better-auth";

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://localhost:3000,http://localhost:3001").split(",").map((origin) => origin.trim()).filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  advanced: { database: { joins: true } },
});

export type AuthSession = typeof auth.$Infer.Session;
