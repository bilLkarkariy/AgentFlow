import { IsNotEmpty, IsString } from 'class-validator';
import { AgentDsl } from '../dsl-parser.service';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  dsl: AgentDsl;
}
