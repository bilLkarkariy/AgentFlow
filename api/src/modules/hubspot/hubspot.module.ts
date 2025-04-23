import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HubspotController } from './hubspot.controller';
import { HubspotService } from './hubspot.service';
import { HubspotCredential } from './hubspot-credential.entity';
import { HubspotTrigger } from './hubspot-trigger.entity';
import { HubspotTriggersService } from './hubspot-triggers.service';
import { HubspotTriggersController } from './hubspot-triggers.controller';
import { HubspotEventsProcessor } from './hubspot-events.processor';
import { HubspotWebhookController } from './webhook.controller';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({ name: 'hubspot-events' }),
    TypeOrmModule.forFeature([HubspotCredential, HubspotTrigger]),
    AgentsModule,
  ],
  controllers: [HubspotController, HubspotTriggersController, HubspotWebhookController],
  providers: [HubspotService, HubspotTriggersService, HubspotEventsProcessor],
  exports: [HubspotService],
})
export class HubspotModule {}
