import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from './agents/agents.module';
import { GmailModule } from './gmail/gmail.module';
import { StripeModule } from './stripe/stripe.module';
import { AuthTokensModule } from './auth-tokens/auth-tokens.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { QueuesModule } from './queues/queues.module';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import * as dotenv from 'dotenv';
import { PennylaneModule } from './pennylane/pennylane.module';
import { SlackModule } from './slack/slack.module';
import { XeroModule } from './xero/xero.module';
import { QuontoModule } from './quonto/quonto.module';
import { SeedModule } from './seed/seed.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BullBoardModule } from './bull-board/bull-board.module';
import { UsersModule } from './users/users.module';
import { MetricsModule } from './metrics/metrics.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SlackAlertInterceptor } from '../common/interceptors/slack-alert.interceptor';
import { TestErrorController } from '../common/controllers/test-error.controller';

dotenv.config();

// Fix PG ESM import for TypeORM
import * as pgPkg from 'pg';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
const pg = pgPkg.default || pgPkg;
const originalLoad = PlatformTools.load;
PlatformTools.load = (moduleName: string) => moduleName === 'pg' ? pg : originalLoad(moduleName);

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        // Use hosted Postgres if configured
        if (process.env.POSTGRES_URL) {
          return {
            type: 'postgres',
            url: process.env.POSTGRES_URL,
            // disable SSL for local Postgres
            ssl: false,
            autoLoadEntities: true,
            synchronize: true,
          };
        }
        // Fallback: if running tests, use in-memory SQLite
        const isTest = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
        if (isTest) {
          return {
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            dropSchema: true,
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
  ],
  controllers: [HealthController, TestErrorController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SlackAlertInterceptor,
    },
  ],
})
export class AppModule {}
