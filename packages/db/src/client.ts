import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  for (const envPath of [".env", "../../.env", "../../../.env"]) {
    const resolved = resolve(process.cwd(), envPath);
    if (existsSync(resolved)) {
      try {
        process.loadEnvFile(resolved);
        if (process.env.DATABASE_URL) break;
      } catch {}
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to connect to Neon.");

export const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
