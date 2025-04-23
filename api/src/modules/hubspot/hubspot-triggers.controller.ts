import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { HubspotTriggersService } from './hubspot-triggers.service';
import { CreateHubspotTriggerDto } from './dto/create-hubspot-trigger.dto';
import { HubspotTrigger } from './hubspot-trigger.entity';

@Controller('api/hubspot/triggers')
export class HubspotTriggersController {
  constructor(private readonly service: HubspotTriggersService) {}

  @Post()
  create(@Body() dto: CreateHubspotTriggerDto): Promise<HubspotTrigger> {
    return this.service.create(dto);
  }

  @Get(':agentId')
  findAll(@Param('agentId') agentId: string): Promise<HubspotTrigger[]> {
    return this.service.findAll(agentId);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
