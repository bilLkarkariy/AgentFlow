import './otel-sdk';
import { chaosMiddleware } from './common/middleware/chaos.middleware';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './modules/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { raw } from 'body-parser';
import { Logger } from 'nestjs-pino';

// Load .env from working directory
dotenv.config();

// Hardening: Validate essential environment variables
const requiredEnv = ['POSTGRES_URL', 'REDIS_HOST', 'REDIS_PORT'];
requiredEnv.forEach(key => {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
});

async function bootstrap() {
  // bufferLogs: keep the bootstrap logs until pino takes over as the logger.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Fault injection for the canary rollback demo (no-op unless CHAOS_ERROR_RATE)
  app.use(chaosMiddleware);
  // Enable x-request-id propagation
  app.use(requestIdMiddleware);
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  // Enable WebSocket adapter for Socket.IO gateways
  app.useWebSocketAdapter(new IoAdapter(app));
  const config = new DocumentBuilder()
    .setTitle('AgentFlow API')
    .setDescription('Skeleton API docs')
    .setVersion('0.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');

  // rawBody for Stripe webhooks
  app.use('/stripe/webhook', raw({ type: 'application/json' }));
}
bootstrap();
