import { Module } from '@nestjs/common';
import { SummarizeService } from './summarize.service';
import { ToolController } from './tool.controller';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [GmailModule],
  providers: [SummarizeService],
  controllers: [ToolController],
})
export class ToolsModule {}
