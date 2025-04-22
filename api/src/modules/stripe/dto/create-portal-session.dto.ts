import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CreatePortalSessionDto {
  @ApiProperty({ example: 'cus_12345', description: 'Stripe customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: 'https://example.com/return', description: 'URL to redirect after session' })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  returnUrl: string;
}
