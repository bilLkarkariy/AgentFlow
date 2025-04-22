import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateFromPromptDto {
  @ApiProperty({ example: 'Create a report', description: 'Prompt to generate an agent' })
  @IsString()
  @IsNotEmpty()
  prompt: string;
}
