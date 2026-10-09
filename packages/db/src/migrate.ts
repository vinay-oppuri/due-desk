import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./client.js";

async function runMigrations() {
  console.log("[Migration] Applying migrations via Neon HTTP...");
  const candidatePaths = [
    resolve(process.cwd(), "../../db/migrations"),
    resolve(process.cwd(), "../db/migrations"),
    resolve(process.cwd(), "db/migrations"),
    resolve(process.cwd(), "dist/../../db/migrations"),
  ];
  const targetFolder = candidatePaths.find((p) => existsSync(p)) || candidatePaths[0]!;
  console.log(`[Migration] Using migrations folder: ${targetFolder}`);

  await migrate(db, { migrationsFolder: targetFolder });
  console.log("[Migration] Migrations applied successfully!");
}

runMigrations().catch((err) => {
  console.error("[Migration Error]:", err);
  process.exit(1);
});
