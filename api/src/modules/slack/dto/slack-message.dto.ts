import { ApiProperty } from '@nestjs/swagger';

export class SlackMessageDto {
  @ApiProperty({ example: '#general', description: 'Target channel or user' })
  channel: string;

  @ApiProperty({ example: 'Hello world', description: 'Message text to send' })
  text: string;
}
