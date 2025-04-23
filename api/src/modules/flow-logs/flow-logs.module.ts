import { Module } from '@nestjs/common';
import { FlowLogsGateway } from './flow-logs.gateway';

@Module({
  providers: [FlowLogsGateway],
  exports: [FlowLogsGateway],
})
export class FlowLogsModule {}
