import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (typeof process.loadEnvFile === 'function') {
  for (const envPath of ['.env', '../../.env', '../.env']) {
    const resolved = resolve(process.cwd(), envPath);
    if (existsSync(resolved)) {
      try {
        process.loadEnvFile(resolved);
        if (process.env.DATABASE_URL) break;
      } catch {}
    }
  }
}

import { NestFactory } from '@nestjs/core';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@repo/auth/server';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? 'http://localhost:3000,http://localhost:3001').split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: trustedOrigins, credentials: true });
  app.use('/api/auth', toNodeHandler(auth));
  app.use(express.json());
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`[NestJS API] listening on http://localhost:${port}`);
}
await bootstrap();
