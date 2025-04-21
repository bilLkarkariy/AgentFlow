import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { XeroService } from './xero.service';
import { XeroAuthService } from './xero-auth.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

@Controller('xero')
export class XeroController {
  constructor(
    private readonly xeroService: XeroService,
    private readonly xeroAuthService: XeroAuthService,
  ) {}

  @Get('invoices')
  async getInvoices(
    @Query('accessToken') accessToken?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    if (accessToken) {
      const conns = await this.xeroAuthService.getConnections(accessToken);
      if (!conns.length) throw new NotFoundException('No Xero connections');
      tenantId = conns[0].tenantId;
    }
    if (!tenantId) throw new BadRequestException('tenantId or accessToken is required');
    return this.xeroService.listInvoices(tenantId, accessToken);
  }

  @Post('invoices')
  async createInvoice(
    @Body() invoice: any,
    @Query('accessToken') accessToken?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    if (accessToken) {
      const conns = await this.xeroAuthService.getConnections(accessToken);
      if (!conns.length) throw new NotFoundException('No Xero connections');
      tenantId = conns[0].tenantId;
    }
    if (!tenantId) throw new BadRequestException('tenantId or accessToken is required');
    return this.xeroService.createInvoice(tenantId, invoice, accessToken);
  }
}
