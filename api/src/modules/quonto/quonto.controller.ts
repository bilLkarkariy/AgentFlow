import { Controller, Get, Query } from '@nestjs/common';
import { QuontoService } from './quonto.service';

@Controller('quonto')
export class QuontoController {
  constructor(private readonly quontoService: QuontoService) {}

  /**
   * List transactions for a given account
   */
  @Get('transactions')
  async listTransactions(@Query('accountId') accountId: string) {
    return this.quontoService.listTransactions(accountId);
  }
}
