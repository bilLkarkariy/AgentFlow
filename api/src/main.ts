import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AppModule } from './modules/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { raw } from 'body-parser';

// Load .env from project root (two levels up from api/src)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function bootstrap() {
  console.log('POSTGRES_URL', process.env.POSTGRES_URL);

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
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
