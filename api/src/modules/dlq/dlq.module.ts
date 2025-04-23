import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DLQBullController } from './dlq-bull.controller';
import { DLQBullService } from './dlq-bull.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'execute-agent' }),
    BullModule.registerQueue({ name: 'agents' }),
  ],
  controllers: [DLQBullController],
  providers: [DLQBullService],
})
export class DLQModule {}
