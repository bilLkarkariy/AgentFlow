import 'dotenv/config';
import './otel-sdk';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { join } from 'path';
import { OtelInterceptor } from './interceptors/otel.interceptor';
import { AgentExecutionInterceptor } from './telemetry/agent-execution.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  // Register OpenTelemetry interceptor for tracing
  app.useGlobalInterceptors(new OtelInterceptor());
  app.useGlobalInterceptors(app.get(AgentExecutionInterceptor));

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Agent Runtime')
    .setDescription('Microservice Agent Runtime API docs')
    .setVersion('0.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 8000;
  // start gRPC microservice
  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      url: '0.0.0.0:50051',
      package: 'agent',
      protoPath: join(__dirname, '../proto/agent.proto'),
    },
  });
  await app.startAllMicroservices();
  // start HTTP server
  await app.listen(port);
  console.log(`Agent Runtime HTTP listening on ${port}`);
  console.log(`Agent Runtime gRPC listening on 0.0.0.0:50051`);
}

bootstrap();
