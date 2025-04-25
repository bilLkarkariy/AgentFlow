import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RunDto {
  @ApiProperty({ description: 'Prompt text to execute', example: 'hello world' })
  @IsString()
  prompt: string;

  @ApiPropertyOptional({ description: 'Optional parameters', type: Object, example: {} })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;
}
