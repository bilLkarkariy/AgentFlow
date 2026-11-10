import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/** Body of `POST /agent/run`, and payload of the `agent-run` BullMQ job. */
export class AgentRunDto {
  @ApiProperty({ description: 'Id of the agent whose stored flow is run' })
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @ApiProperty({ example: 'Hello', description: 'Input message given to the root agent' })
  @IsString()
  input: string;
}
