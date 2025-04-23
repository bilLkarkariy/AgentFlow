import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

@Injectable()
export class DLQBullService {
  constructor(
    @InjectQueue('execute-agent') private readonly executeQueue: Queue,
    @InjectQueue('agents') private readonly agentsQueue: Queue,
  ) {}

  async getFailed(queueName: string): Promise<Job[]> {
    const queue = queueName === 'execute-agent' ? this.executeQueue : this.agentsQueue;
    return queue.getFailed(0, -1);
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = queueName === 'execute-agent' ? this.executeQueue : this.agentsQueue;
    const job = await queue.getJob(jobId);
    if (job) {
      await job.retry();
    }
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = queueName === 'execute-agent' ? this.executeQueue : this.agentsQueue;
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}  
