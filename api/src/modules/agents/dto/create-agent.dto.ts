import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AgentDsl } from '../dsl-parser.service';

export class CreateAgentDto {
  @ApiProperty({ example: 'MyAgent', description: 'Name of the agent' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: Object, description: 'DSL object defining agent behavior' })
  @IsNotEmpty()
  dsl: AgentDsl;
}
