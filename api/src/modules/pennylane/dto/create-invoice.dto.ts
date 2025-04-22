import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsDateString, IsOptional } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ example: 1500, description: 'Amount of the invoice' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'EUR', description: 'Currency code' })
  @IsString()
  currency: string;

  @ApiProperty({ example: 'customer_123', description: 'Customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '2025-04-01', description: 'Invoice date in ISO format' })
  @IsDateString()
  invoiceDate: string;

  @ApiProperty({ example: 'Consulting services', description: 'Optional description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
