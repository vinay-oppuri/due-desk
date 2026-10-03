import { NestFactory } from '@nestjs/core';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@repo/auth/server';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? 'http://localhost:3000,http://localhost:3001').split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: trustedOrigins, credentials: true });
  app.use('/api/auth/*', toNodeHandler(auth));
  app.use(express.json());
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
