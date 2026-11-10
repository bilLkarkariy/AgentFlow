import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

@Injectable()
export class DLQBullService {
  constructor(
    @InjectQueue('agent-run') private readonly agentRunQueue: Queue,
    @InjectQueue('agents') private readonly agentsQueue: Queue,
  ) {}

  /** An unknown queue name is a 404, not a silent look at another queue. */
  private queue(queueName: string): Queue {
    if (queueName === 'agent-run') return this.agentRunQueue;
    if (queueName === 'agents') return this.agentsQueue;
    throw new NotFoundException(`Unknown queue: ${queueName}`);
  }

  async getFailed(queueName: string): Promise<Job[]> {
    return this.queue(queueName).getFailed(0, -1);
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.queue(queueName).getJob(jobId);
    if (job) {
      await job.retry();
    }
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.queue(queueName).getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}  
