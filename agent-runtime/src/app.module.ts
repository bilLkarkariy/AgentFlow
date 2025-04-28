import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AgentController } from './controllers/agent.controller';
import { AgentService } from './services/agent.service';
import { AgentGrpcController } from './controllers/agent.grpc.controller';
import { TelemetryModule } from './telemetry/telemetry.module';
import { MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { AgentExecutionMiddleware } from './telemetry/agent-execution.middleware';
import { MetricsModule } from './metrics/metrics.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { OtelInterceptor } from './interceptors/otel.interceptor';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    ClientsModule.register([{
      name: 'AGENT_PACKAGE',
      transport: Transport.GRPC,
      options: {
        url: process.env.CREW_RUNTIME_URL || 'localhost:50051', // internal
        package: 'agent',
        protoPath: join(__dirname, '../proto/agent.proto'),
      },
    }]),
    TelemetryModule,
    MetricsModule, // expose /metrics endpoint
  ],
  controllers: [AgentController, AgentGrpcController],
  providers: [
    AgentService,
    { provide: APP_INTERCEPTOR, useClass: OtelInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AgentExecutionMiddleware).forRoutes({ path: 'run', method: RequestMethod.POST });
  }
}
