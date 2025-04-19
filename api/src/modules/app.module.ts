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

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const isJest = process.env.JEST_WORKER_ID !== undefined;
        if (isJest) {
          return {
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            dropSchema: true,
          };
        }
        return {
          type: 'postgres',
          url: process.env.POSTGRES_URL,
          autoLoadEntities: true,
          synchronize: true,
        };
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
