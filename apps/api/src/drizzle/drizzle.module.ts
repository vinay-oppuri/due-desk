import { Module, Global } from '@nestjs/common';
import { db } from '@repo/db';

/**
 * Injection token for the Drizzle database instance.
 * Use `@Inject(DRIZZLE)` in any service constructor to access the database.
 */
export const DRIZZLE = Symbol('DRIZZLE');

/**
 * Global NestJS module that provides the shared Drizzle database connection.
 *
 * Import this once in `AppModule` — the `db` instance from `@repo/db`
 * is then injectable in every module via `@Inject(DRIZZLE)`.
 */
@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useValue: db,
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
