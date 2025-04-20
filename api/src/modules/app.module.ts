import { Module } from '@nestjs/common';
import { HealthController } from '../controllers/health.controller';
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
            ssl: { rejectUnauthorized: false },
            autoLoadEntities: true,
            synchronize: true,
          };
        }
        // Else run tests in-memory (SQLite)
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
    QueuesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
