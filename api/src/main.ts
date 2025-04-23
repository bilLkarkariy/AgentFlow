import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './modules/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { raw } from 'body-parser';

// Load .env from project root (two levels up from api/src)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Hardening: Validate essential environment variables
const requiredEnv = ['POSTGRES_URL', 'REDIS_HOST', 'REDIS_PORT'];
requiredEnv.forEach(key => {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
});

async function bootstrap() {
  console.log('POSTGRES_URL', process.env.POSTGRES_URL);

  const app = await NestFactory.create(AppModule);
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

  await app.listen(3000);

  // rawBody for Stripe webhooks
  app.use('/stripe/webhook', raw({ type: 'application/json' }));
}
bootstrap();
