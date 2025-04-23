import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FlowGateway } from '../agents/flow/flow.gateway';

@Processor('hubspot-events')
export class HubspotEventsProcessor extends WorkerHost {
  constructor(private readonly flowGateway: FlowGateway) { super(); }

  async process(job: Job<any>): Promise<void> {
    // Simply push event to websocket gateway for now
    this.flowGateway.server?.emit('hubspot-event', job.data);
  }
}
