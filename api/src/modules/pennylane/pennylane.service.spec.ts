import { PennylaneService } from './pennylane.service';
import { InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PennylaneService', () => {
  let service: PennylaneService;

  beforeEach(() => {
    process.env.PENNYLANE_BASE_URL = 'https://api.test.pennylane.io';
    process.env.PENNYLANE_API_TOKEN = 'test-token';
    service = new PennylaneService();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.put.mockReset();
  });



  it('createInvoice should call axios.post with correct URL, data, and headers', async () => {
    const input = { amount: 200 };
    const responseData = { id: 'inv_456', amount: 200 };
    mockedAxios.post.mockResolvedValue({ data: responseData });

    const result = await service.createInvoice(input);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.test.pennylane.io/external/v2/customer_invoices',
      input,
      { headers: { Authorization: 'Bearer test-token', Accept: 'application/json' } }
    );
    expect(result).toEqual(responseData);
  });

  it('createInvoice should throw InternalServerErrorException on failure', async () => {
    const errorData = { message: 'Bad Request' };
    mockedAxios.post.mockRejectedValue({ response: { data: errorData } });

    await expect(service.createInvoice({})).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('updateInvoice should call axios.put with correct URL, data, and headers', async () => {
    const invoiceId = 'inv_789';
    const updateData = { amount: 300 };
    const responseData = { id: invoiceId, amount: 300 };
    mockedAxios.put.mockResolvedValue({ data: responseData });

    const result = await service.updateInvoice(invoiceId, updateData);

    expect(mockedAxios.put).toHaveBeenCalledWith(
      `https://api.test.pennylane.io/external/v2/customer_invoices/${invoiceId}`,
      updateData,
      { headers: { Authorization: 'Bearer test-token', Accept: 'application/json' } }
    );
    expect(result).toEqual(responseData);
  });

  it('updateInvoice should throw InternalServerErrorException on failure', async () => {
    const invoiceId = 'inv_000';
    const errorData = { message: 'Not Found' };
    mockedAxios.put.mockRejectedValue({ response: { data: errorData } });

    await expect(service.updateInvoice(invoiceId, {})).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('createCompanyCustomer should call axios.post with correct URL, data, and headers', async () => {
    const input = { name: 'Test Co', vat_number: 'VAT123', reg_no: 'REG456', billing_address: { line1: '123 Main St', city: 'Paris', zip_code: '75001', country: 'FR' } };
    const responseData = { id: 'co-id', ...input };
    mockedAxios.post.mockResolvedValue({ data: responseData });

    const result = await service.createCompanyCustomer(input);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.test.pennylane.io/external/v2/company_customers',
      input,
      { headers: { Authorization: 'Bearer test-token', Accept: 'application/json' } }
    );
    expect(result).toEqual(responseData);
  });

  it('createIndividualCustomer should call axios.post with correct URL, data, and headers', async () => {
    const input = { first_name: 'Jane', last_name: 'Doe', billing_address: { line1: '456 Elm St', city: 'Lyon', zip_code: '69000', country: 'FR' } };
    const responseData = { id: 'ind-id', ...input };
    mockedAxios.post.mockResolvedValue({ data: responseData });

    const result = await service.createIndividualCustomer(input);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.test.pennylane.io/external/v2/individual_customers',
      input,
      { headers: { Authorization: 'Bearer test-token', Accept: 'application/json' } }
    );
    expect(result).toEqual(responseData);
  });
});
