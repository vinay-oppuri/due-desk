import { sql as rawNeonSql } from "./client.js";
import { sql } from "drizzle-orm";
import type { DrizzleDB } from "./client.js";

export interface TenantContext {
  organizationId: string;
  userId?: string;
  bypassRls?: boolean;
}

/**
 * Executes a scoped query batch over Neon HTTP enforcing Postgres RLS policies.
 * Guarantees that app.current_org_id is set atomically and cannot leak across requests.
 */
export async function withTenantHttp<T>(
  context: TenantContext,
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await rawNeonSql.transaction([
    rawNeonSql.query("SET LOCAL ROLE app_user"),
    rawNeonSql.query(
      `SET LOCAL app.bypass_rls = '${context.bypassRls ? "on" : "off"}'`,
    ),
    rawNeonSql.query(
      `SET LOCAL app.current_org_id = '${context.organizationId}'`,
    ),
    ...(context.userId
      ? [
          rawNeonSql.query(
            `SET LOCAL app.current_user_id = '${context.userId}'`,
          ),
        ]
      : []),
    rawNeonSql.query(query, params),
  ]);

  const targetIndex = context.userId ? 4 : 3;
  return (res[targetIndex] ?? []) as T[];
}

/**
 * Sets session configuration variables on a Drizzle connection/transaction for RLS.
 */
export async function applyTenantRls(
  dbOrTx: DrizzleDB,
  context: TenantContext,
): Promise<void> {
  const bypass = context.bypassRls ? "on" : "off";
  const userSetting = context.userId
    ? `SET LOCAL app.current_user_id = '${context.userId}';`
    : "";

  await dbOrTx.execute(
    sql.raw(
      `SET LOCAL ROLE app_user; SET LOCAL app.bypass_rls = '${bypass}'; SET LOCAL app.current_org_id = '${context.organizationId}'; ${userSetting}`,
    ),
  );
}
