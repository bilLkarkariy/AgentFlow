import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskRun } from '../tasks/task-run.entity';
import { FlowGateway } from '../agents/flow/flow.gateway';

/**
 * Streams an agent run to the websocket room named after the job id and
 * persists a `TaskRun` row.
 *
 * No Prometheus metric is emitted here: duration, tokens and spend are all
 * recorded once, with bounded labels, in `AgentPythonClientService`.
 */
@Injectable()
@Processor('agent-run')
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);

  constructor(
    private readonly runtime: AgentRuntimeService,
    @InjectRepository(TaskRun)
    private readonly taskRunRepo: Repository<TaskRun>,
    private readonly gateway: FlowGateway,
  ) {
    super();
  }

  async process(job: Job<{ flowId: string; nodeId: string; input: any }>): Promise<void> {
    const jobId = job.id.toString();
    this.gateway.server.to(jobId).emit('log', { message: 'Agent run start' });
    try {
      const results = await this.runtime.run(job.data.flowId, job.data.input);
      for (const chunk of results) {
        this.gateway.server.to(jobId).emit('log', { message: chunk });
      }
    } catch (err) {
      this.logger.error(`Agent run failed for job ${jobId}`, err);
      throw err; // allow BullMQ to retry
    }
    await this.taskRunRepo.save({ subscriptionItemId: jobId, taskType: 'agent' });
    this.gateway.server.to(jobId).emit('log', { message: 'Agent run complete' });
  }
}
