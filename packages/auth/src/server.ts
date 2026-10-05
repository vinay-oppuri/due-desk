import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, memberships, organizations } from "@repo/db";
import * as schema from "@repo/db/schema";
import { env } from "@repo/env";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { sendOtpEmail } from "./email.js";

export * from "./roles.js";
export { sendOtpEmail, getLatestOtpForTesting } from "./email.js";

const socialProvidersConfig: Record<
  string,
  { clientId: string; clientSecret: string }
> = {};

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProvidersConfig.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  socialProvidersConfig.github = {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
  emailAndPassword: { enabled: false },
  socialProviders: socialProvidersConfig,
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendOtpEmail({ email, otp, type });
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const orgId = `org_${randomUUID().replace(/-/g, "")}`;
          const memberId = `mem_${randomUUID().replace(/-/g, "")}`;
          const orgName = user.name
            ? `${user.name}'s Organization`
            : `${user.email.split("@")[0]}'s Organization`;

          await db.insert(organizations).values({
            id: orgId,
            name: orgName,
            type: "business",
          });

          await db.insert(memberships).values({
            id: memberId,
            organizationId: orgId,
            userId: user.id,
            role: "owner",
          });
        },
      },
    },
  },
  advanced: { database: { joins: true } },
});

export type AuthSession = typeof auth.$Infer.Session;
