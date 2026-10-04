import type { db } from '@repo/db';

/**
 * The Drizzle database type — use this to type `@Inject(DRIZZLE)` parameters.
 *
 * @example
 * ```ts
 * constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}
 * ```
 */
export type DrizzleDB = typeof db;
