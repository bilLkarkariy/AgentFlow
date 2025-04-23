import { Controller, Get, Param, Query, Delete } from '@nestjs/common';
import { HubspotService } from './hubspot.service';
import { HubspotCredential } from './hubspot-credential.entity';

@Controller('api/hubspot')
export class HubspotController {
  constructor(private readonly hubspotService: HubspotService) {}

  @Get('authorize/:agentId')
  getAuthorizationUrl(@Param('agentId') agentId: string): { url: string } {
    return { url: this.hubspotService.getAuthorizationUrl(agentId) };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') agentId: string,
  ): Promise<HubspotCredential> {
    return this.hubspotService.handleCallback(agentId, code);
  }

  @Get('credentials/:agentId')
  async getCredentials(@Param('agentId') agentId: string): Promise<HubspotCredential> {
    return this.hubspotService.getCredentials(agentId);
  }

  @Delete('credentials/:agentId')
  async removeCredentials(@Param('agentId') agentId: string): Promise<void> {
    return this.hubspotService.removeCredentials(agentId);
  }
}
