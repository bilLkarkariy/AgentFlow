import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'user@example.com', description: 'Customer email' })
  @IsEmail()
  email: string;
}
