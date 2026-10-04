import { defineConfig } from "drizzle-kit";
import { env } from "@repo/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "../../db/migrations",
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,
  verbose: true,
});
