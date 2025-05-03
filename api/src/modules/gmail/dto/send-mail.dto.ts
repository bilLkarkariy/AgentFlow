import { IsString, IsOptional, IsIn } from 'class-validator';

export class SendMailDto {
  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  nodeId?: string;

  @IsString()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsIn(['sync', 'async'])
  mode?: 'sync' | 'async';
}
