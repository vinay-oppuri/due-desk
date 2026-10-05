import { NestFactory } from '@nestjs/core';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@repo/auth/server';
import { env } from '@repo/env';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors({
    origin: env.BETTER_AUTH_TRUSTED_ORIGINS,
    credentials: true,
  });
  app.use('/api/auth', toNodeHandler(auth));
  app.use(express.json());
  await app.listen(env.PORT);
  console.log(`[NestJS API] listening on http://localhost:${env.PORT}`);
}
await bootstrap();
