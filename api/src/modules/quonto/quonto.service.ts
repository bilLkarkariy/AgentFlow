import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { Logger } from '@nestjs/common';

@Injectable()
export class QuontoService {
  private readonly baseURL = 'https://thirdparty.qonto.com/v2';
  private readonly authHeader: string;
  private readonly enabled: boolean;
  private readonly logger = new Logger(QuontoService.name);

  constructor() {
    const login = process.env.QUONTO_CLIENT_ID;
    const secret = process.env.QUONTO_CLIENT_SECRET;
    this.enabled = !!(login && secret);
    if (!this.enabled) {
      // Never throw at construction: a missing optional connector must not stop the app from booting.
      this.logger.warn('Quonto credentials not configured, the Quonto endpoints are disabled');
    }
    this.authHeader = Buffer.from(`${login}:${secret}`).toString('utf-8');
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Quonto not configured');
    }
  }

  /**
   * List bank transactions
   */
  async listTransactions(accountId: string): Promise<any[]> {
    this.assertEnabled();
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
