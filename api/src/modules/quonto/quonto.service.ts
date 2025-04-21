import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { Logger } from '@nestjs/common';

@Injectable()
export class QuontoService {
  private readonly baseURL = 'https://thirdparty.qonto.com/v2';
  private readonly authHeader: string;
  private readonly logger = new Logger(QuontoService.name);

  constructor() {
    const login = process.env.QUONTO_CLIENT_ID;
    const secret = process.env.QUONTO_CLIENT_SECRET;
    if (!login || !secret) {
      throw new InternalServerErrorException('Quonto credentials not configured');
    }
    this.authHeader = `${login}:${secret}`;
    this.authHeader = Buffer.from(this.authHeader).toString('utf-8');
  }

  /**
   * List bank transactions
   */
  async listTransactions(accountId: string): Promise<any[]> {
    const url = `${this.baseURL}/transactions`;
    this.logger.log(`Fetching transactions for accountId=${accountId}`);
    try {
      const res = await axios.get(
        url,
        {
          headers: { Authorization: this.authHeader },
          params: { bank_account_id: accountId },
        }
      );
      this.logger.log(`Fetched ${Array.isArray(res.data.transactions) ? res.data.transactions.length : 'unknown'} transactions`);
      return res.data.transactions;
    } catch (err) {
      const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      this.logger.error(`Failed to fetch transactions for accountId=${accountId}`, errMsg);
      throw new InternalServerErrorException(`Failed to fetch transactions: ${errMsg}`);
    }
  }
}
