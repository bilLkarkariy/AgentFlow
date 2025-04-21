import { QuontoService } from './quonto.service';
import axios from 'axios';
import { InternalServerErrorException } from '@nestjs/common';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('QuontoService', () => {
  let service: QuontoService;

  beforeEach(() => {
    process.env.QUONTO_CLIENT_ID = 'login';
    process.env.QUONTO_CLIENT_SECRET = 'secret';
    mockedAxios.get.mockReset();
    service = new QuontoService();
  });

  it('listTransactions should call axios.get with correct URL and header', async () => {
    const transactionsArray = [{ id: '1', amount: 100 }];
    mockedAxios.get.mockResolvedValue({ data: { transactions: transactionsArray } });

    const result = await service.listTransactions('acct1');
    const expectedAuth = Buffer.from('login:secret').toString('utf-8');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://thirdparty.qonto.com/v2/transactions',
      {
        headers: { Authorization: expectedAuth },
        params: { bank_account_id: 'acct1' },
      },
    );
    expect(result).toEqual(transactionsArray);
  });

  it('constructor should throw if credentials missing', () => {
    delete process.env.QUONTO_CLIENT_ID;
    delete process.env.QUONTO_CLIENT_SECRET;
    expect(() => new QuontoService()).toThrow(InternalServerErrorException);
  });
});
