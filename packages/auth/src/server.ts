import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, memberships, organizations } from "@repo/db";
import * as schema from "@repo/db/schema";
import { env } from "@repo/env";
import { betterAuth } from "better-auth";

export * from "./roles.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
  emailAndPassword: { enabled: true, requireEmailVerification: false },
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
