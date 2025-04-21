import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { PennylaneService } from './pennylane.service';

@Controller('pennylane')
export class PennylaneController {
  constructor(private readonly pennylaneService: PennylaneService) {}

  @Get('invoices')
  async getInvoices() {
    return this.pennylaneService.listInvoices();
  }

  @Post('invoices')
  async createInvoice(@Body() data: any) {
    return this.pennylaneService.createInvoice(data);
  }

  @Put('invoices/:id')
  async updateInvoice(@Param('id') id: string, @Body() data: any) {
    return this.pennylaneService.updateInvoice(id, data);
  }

  /**
   * Create a company customer (alpha)
   */
  @Post('company_customers')
  async createCompanyCustomer(@Body() data: any) {
    return this.pennylaneService.createCompanyCustomer(data);
  }

  /**
   * Create an individual customer (alpha)
   */
  @Post('individual_customers')
  async createIndividualCustomer(@Body() data: any) {
    return this.pennylaneService.createIndividualCustomer(data);
  }
}
