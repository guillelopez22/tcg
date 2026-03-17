import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { runMigrations } from '@la-grieta/db';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Run DB migrations before the app starts accepting traffic.
  // If migrations fail we crash intentionally — Railway will retry.
  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set — cannot run migrations or start');
  }
  console.log('Running database migrations...');
  await runMigrations(dbUrl);
  console.log('Database migrations complete');

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    { bodyParser: false },
  );

  // Re-enable JSON body parser with 5MB limit (base64 camera frames exceed the 100KB default)
  app.use(json({ limit: '5mb' }));

  // Security headers (H2)
  app.use(helmet());

  // Cookie parsing — required for httpOnly refresh token cookies (C3)
  app.use(cookieParser());

  // Trust only the first proxy so req.ip uses X-Forwarded-For correctly
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Global API prefix — controllers must NOT duplicate this
  const apiPrefix = process.env['API_PREFIX'] ?? 'api';
  app.setGlobalPrefix(apiPrefix);

  // Enable CORS
  const corsOrigins = process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Socket.IO adapter for WebSocket gateway
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = parseInt(process.env['PORT'] ?? process.env['API_PORT'] ?? '3001', 10);
  await app.listen(port);
  console.log(`La Grieta API running on http://localhost:${port}/${apiPrefix} [v2]`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
