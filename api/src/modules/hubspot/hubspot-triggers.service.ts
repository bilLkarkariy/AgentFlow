import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HubspotTrigger } from './hubspot-trigger.entity';
import { CreateHubspotTriggerDto } from './dto/create-hubspot-trigger.dto';
import { HubspotService } from './hubspot.service';

@Injectable()
export class HubspotTriggersService {
  constructor(
    @InjectRepository(HubspotTrigger)
    private readonly repo: Repository<HubspotTrigger>,
    private readonly hubspotService: HubspotService,
  ) {}

  async create(dto: CreateHubspotTriggerDto): Promise<HubspotTrigger> {
    // subscribe via HubSpot API
    await this.hubspotService.subscribeAppWebhook(dto.eventType);
    const trigger = this.repo.create({ agent: { id: dto.agentId } as any, eventType: dto.eventType });
    return this.repo.save(trigger);
  }

  findAll(agentId: string): Promise<HubspotTrigger[]> {
    return this.repo.find({ where: { agent: { id: agentId } } });
  }

  async remove(id: string): Promise<void> {
    const trigger = await this.repo.findOne({ where: { id } });
    if (!trigger) throw new NotFoundException('Trigger not found');
    await this.repo.remove(trigger);
  }
}
