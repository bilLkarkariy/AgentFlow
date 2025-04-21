import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PennylaneService {
  private readonly logger = new Logger(PennylaneService.name);
  // Ensure no trailing slash and use external v2 API
  private readonly baseURL = (process.env.PENNYLANE_BASE_URL || 'https://app.pennylane.com/api').replace(/\/$/, '');
  private readonly token = process.env.PENNYLANE_API_TOKEN;

  /**
   * Fetches the list of invoices from Pennylane API
   */
  async listInvoices(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/external/v2/customer_invoices`,
        { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' } },
      );
      // Return only the invoices array
      return response.data.items;
    } catch (err) {
      // Log error details for debugging
      console.error('Error fetching customer_invoices:', err.response?.status, err.response?.data || err.message);
      this.logger.error('Failed to list invoices', err.response?.data || err.message);
      throw new InternalServerErrorException(
        `Failed to list invoices: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`
      );
    }
  }

  /**
   * Create a new invoice
   */
  async createInvoice(data: any): Promise<any> {
    try {
      // Map line_items to invoice_lines for Pennylane API
      const payload = { ...data };
      if (payload.line_items) {
        payload.invoice_lines = payload.line_items;
        delete payload.line_items;
      }
      const res = await axios.post(
        `${this.baseURL}/external/v2/customer_invoices`,
        payload,
        { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' } },
      );
      return res.data;
    } catch (err) {
      this.logger.error('Failed to create invoice', err.response?.data || err.message);
      throw new InternalServerErrorException(
        `Failed to create invoice: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`
      );
    }
  }

  /**
   * Update an existing invoice
   */
  async updateInvoice(invoiceId: string, data: any): Promise<any> {
    try {
      // Map line_items to invoice_lines for Pennylane API
      const payload = { ...data };
      if (payload.line_items) {
        payload.invoice_lines = payload.line_items;
        delete payload.line_items;
      }
      const res = await axios.put(
        `${this.baseURL}/external/v2/customer_invoices/${invoiceId}`,
        payload,
        { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' } },
      );
      return res.data;
    } catch (err) {
      this.logger.error(`Failed to update invoice id=${invoiceId}`, err.response?.data || err.message);
      throw new InternalServerErrorException(
        `Failed to update invoice: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`
      );
    }
  }

  /**
   * Create a company customer (alpha)
   */
  async createCompanyCustomer(data: any): Promise<any> {
    try {
      const res = await axios.post(
        `${this.baseURL}/external/v2/company_customers`,
        data,
        { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' } },
      );
      return res.data;
    } catch (err) {
      // Log error details for debugging
      console.error('Error creating company customer:', err.response?.status, err.response?.data || err.message);
      this.logger.error('Failed to create company customer', err.response?.data || err.message);
      throw new InternalServerErrorException(
        `Failed to create company customer: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`
      );
    }
  }

  /**
   * Create an individual customer (alpha)
   */
  async createIndividualCustomer(data: any): Promise<any> {
    try {
      const res = await axios.post(
        `${this.baseURL}/external/v2/individual_customers`,
        data,
        { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' } },
      );
      return res.data;
    } catch (err) {
      // Log error details for debugging
      console.error('Error creating individual customer:', err.response?.status, err.response?.data || err.message);
      this.logger.error('Failed to create individual customer', err.response?.data || err.message);
      throw new InternalServerErrorException(
        `Failed to create individual customer: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`
      );
    }
  }
}
