import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskRun } from '../tasks/task-run.entity';
import { FlowGateway } from '../agents/flow/flow.gateway';
import { Histogram, Counter } from 'prom-client';
import pricing from '../../pricing.json';

@Injectable()
@Processor('agent-run')
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);
  private readonly durationHistogram: Histogram<string>;
  private readonly tokensCounter: Counter<string>;
  private readonly euroCounter: Counter<string>;

  constructor(
    private readonly runtime: AgentRuntimeService,
    @InjectRepository(TaskRun)
    private readonly taskRunRepo: Repository<TaskRun>,
    private readonly gateway: FlowGateway,
  ) {
    super();
    this.durationHistogram = new Histogram({
      name: 'agent_duration_seconds',
      help: 'Duration of agent runtime in seconds',
      labelNames: ['jobId'],
    });
    this.tokensCounter = new Counter({
      name: 'agent_tokens_total',
      help: 'Total tokens processed by agent runtime',
      labelNames: ['jobId'],
    });
    this.euroCounter = new Counter({
      name: 'agent_euro_total',
      help: 'Total euros spent by agent runtime',
      labelNames: ['jobId'],
    });
  }

  async process(job: Job<{ flowId: string; nodeId: string; input: any }>): Promise<void> {
    const jobId = job.id.toString();
    this.gateway.server.to(jobId).emit('log', { message: 'Agent run start' });
    const endTimer = this.durationHistogram.startTimer({ jobId });
    let success = false;
    try {
      const results = await this.runtime.run(job.data.flowId, job.data.input);
      for (const chunk of results) {
        this.tokensCounter.inc({ jobId }, 1);
        const cost = pricing.default;
        this.euroCounter.inc({ jobId }, cost);
        this.gateway.server.to(jobId).emit('log', { message: chunk });
      }
      success = true;
    } catch (err) {
      this.logger.error(`Agent run failed for job ${jobId}`, err);
      throw err; // allow BullMQ to retry
    } finally {
      endTimer();
    }
    if (success) {
      await this.taskRunRepo.save({ subscriptionItemId: jobId, taskType: 'agent' });
      this.gateway.server.to(jobId).emit('log', { message: 'Agent run complete' });
    }
  }
}