import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../common/logging/logger.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './health/health.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from './agents/agents.module';
import { GmailModule } from './gmail/gmail.module';
import { StripeModule } from './stripe/stripe.module';
import { AuthTokensModule } from './auth-tokens/auth-tokens.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { QueuesModule } from './queues/queues.module';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PennylaneModule } from './pennylane/pennylane.module';
import { SlackModule } from './slack/slack.module';
import { XeroModule } from './xero/xero.module';
import { QuontoModule } from './quonto/quonto.module';
import { SeedModule } from './seed/seed.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BullBoardModule } from './bull-board/bull-board.module';
import { UsersModule } from './users/users.module';
import { MetricsModule } from './metrics/metrics.module';
import { PricingModule } from './pricing/pricing.module';
import { FlowLogsModule } from './flow-logs/flow-logs.module';
import { DLQModule } from './dlq/dlq.module';
import { HubspotModule } from './hubspot/hubspot.module';
import { ToolsModule } from './tools/tools.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SlackAlertInterceptor } from '../common/interceptors/slack-alert.interceptor';
import { TestErrorController } from '../common/controllers/test-error.controller';
import { WebhookTriggerModule } from './webhook-trigger/webhook-trigger.module';

// Configuration loaded by ConfigModule

// Fix PG ESM import for TypeORM
import pgPkg = require('pg');
import { PlatformTools } from 'typeorm/platform/PlatformTools';
const pg = pgPkg;
const originalLoad = PlatformTools.load;
PlatformTools.load = (moduleName: string) => moduleName === 'pg' ? pg : originalLoad(moduleName);

// scheduling module for cron jobs
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        // Use in-memory SQLite for tests
        const isTestDb = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
        if (isTestDb) {
          return {
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            dropSchema: true,
          };
        }
        // Use hosted Postgres if configured
        if (process.env.POSTGRES_URL) {
          return {
            type: 'postgres',
            url: process.env.POSTGRES_URL,
            // SSL is required by managed Postgres (RDS), disabled locally
            ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
            autoLoadEntities: true,
            // schema is owned by the migrations, never by the app
            synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
            migrationsRun: false,
          };
        }
        throw new Error('DATABASE URL not configured');
      },
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    AgentsModule,
    GmailModule,
    AuthTokensModule,
    RabbitMQModule,
    StripeModule,
    SlackModule,
    XeroModule,
    PennylaneModule,
    QueuesModule,
    BullBoardModule,
    QuontoModule,
    SeedModule,
    DashboardModule,
    UsersModule,
    MetricsModule,
    PricingModule,
    FlowLogsModule,
    DLQModule,
    HubspotModule,
    ToolsModule,
    WebhookTriggerModule,
    HealthModule,
  ],
  controllers: [TestErrorController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SlackAlertInterceptor,
    },
  ],
})
export class AppModule {}
