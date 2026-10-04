import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./client.js";

async function runMigrations() {
  console.log("[Migration] Applying migrations via Neon HTTP...");
  const migrationsFolder = resolve(process.cwd(), "../../db/migrations");
  const targetFolder = existsSync(migrationsFolder)
    ? migrationsFolder
    : resolve(process.cwd(), "db/migrations");

  await migrate(db, { migrationsFolder: targetFolder });
  console.log("[Migration] Migrations applied successfully!");
}

runMigrations().catch((err) => {
  console.error("[Migration Error]:", err);
  process.exit(1);
});
