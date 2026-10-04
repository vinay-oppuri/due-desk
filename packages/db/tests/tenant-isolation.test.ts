import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { sql } from "../src/client.js";

// Load .env
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

describe("Tenant Isolation via Postgres Row Level Security (RLS)", () => {
  const orgA = `test_org_a_${Date.now()}`;
  const orgB = `test_org_b_${Date.now()}`;
  const bizA = `biz_a_${Date.now()}`;
  const bizB = `biz_b_${Date.now()}`;

  beforeAll(async () => {
    // Insert test organizations and businesses using bypass_rls
    await sql.transaction([
      sql.query("SET LOCAL app.bypass_rls = 'on'"),
      sql.query(
        `INSERT INTO organizations (id, name, type) VALUES ('${orgA}', 'Org Alpha', 'business'), ('${orgB}', 'Org Beta', 'business')`
      ),
      sql.query(
        `INSERT INTO businesses (id, organization_id, name, state, business_type, turnover_bracket) VALUES ` +
          `('${bizA}', '${orgA}', 'Alpha Logistics', 'KA', 'private_limited', 'under_20l'), ` +
          `('${bizB}', '${orgB}', 'Beta Retail', 'MH', 'proprietorship', 'under_20l')`
      ),
    ]);
  });

  afterAll(async () => {
    // Cleanup test data
    await sql.transaction([
      sql.query("SET LOCAL app.bypass_rls = 'on'"),
      sql.query(`DELETE FROM businesses WHERE id IN ('${bizA}', '${bizB}')`),
      sql.query(`DELETE FROM organizations WHERE id IN ('${orgA}', '${orgB}')`),
    ]);
  });

  it("User in Org A can only read Org A's businesses and NOT Org B's rows", async () => {
    const resA = await sql.transaction([
      sql.query("SET LOCAL ROLE app_user"),
      sql.query("SET LOCAL app.bypass_rls = 'off'"),
      sql.query(`SET LOCAL app.current_org_id = '${orgA}'`),
      sql.query("SELECT id, organization_id, name FROM businesses"),
    ]);

    const rowsA = resA[3] as Array<{ id: string; organization_id: string; name: string }>;
    expect(rowsA.length).toBe(1);
    expect(rowsA[0]?.id).toBe(bizA);
    expect(rowsA[0]?.organization_id).toBe(orgA);
    expect(rowsA.some((r) => r.id === bizB)).toBe(false);
  });

  it("User in Org B can only read Org B's businesses and NOT Org A's rows", async () => {
    const resB = await sql.transaction([
      sql.query("SET LOCAL ROLE app_user"),
      sql.query("SET LOCAL app.bypass_rls = 'off'"),
      sql.query(`SET LOCAL app.current_org_id = '${orgB}'`),
      sql.query("SELECT id, organization_id, name FROM businesses"),
    ]);

    const rowsB = resB[3] as Array<{ id: string; organization_id: string; name: string }>;
    expect(rowsB.length).toBe(1);
    expect(rowsB[0]?.id).toBe(bizB);
    expect(rowsB[0]?.organization_id).toBe(orgB);
    expect(rowsB.some((r) => r.id === bizA)).toBe(false);
  });

  it("Query with no org context returns 0 rows (strict default deny)", async () => {
    const resNone = await sql.transaction([
      sql.query("SET LOCAL ROLE app_user"),
      sql.query("SET LOCAL app.bypass_rls = 'off'"),
      sql.query("SET LOCAL app.current_org_id = ''"),
      sql.query("SELECT id, organization_id, name FROM businesses"),
    ]);

    const rows = resNone[3] as Array<{ id: string }>;
    expect(rows.length).toBe(0);
  });
});
