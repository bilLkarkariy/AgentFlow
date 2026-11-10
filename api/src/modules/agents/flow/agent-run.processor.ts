import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { TaskRun } from '../../tasks/task-run.entity';
import { FlowEngineService } from '../../agent-runtime/flow-engine.service';
import { FlowGateway } from './flow.gateway';
import { FlowService } from './flow.service';
import { FlowDto } from './flow.dto';

export interface AgentRunJob {
  agentId: string;
  input: string;
}

/**
 * Runs the stored flow of an agent, streams its output to the websocket room
 * named after the job id and persists a `TaskRun` row.
 *
 * A failed run is retried by BullMQ (attempts and backoff are set where the
 * queue is registered), except when retrying cannot help: an unknown agent or
 * an agent without a flow fails the job at once.
 *
 * No Prometheus metric is emitted here: duration, tokens and spend are all
 * recorded once, with bounded labels, in `AgentPythonClientService`.
 */
@Injectable()
@Processor('agent-run')
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);

  constructor(
    private readonly flows: FlowService,
    private readonly engine: FlowEngineService,
    @InjectRepository(TaskRun)
    private readonly taskRunRepo: Repository<TaskRun>,
    private readonly gateway: FlowGateway,
  ) {
    super();
  }

  async process(job: Job<AgentRunJob>): Promise<void> {
    const jobId = job.id.toString();
    const { agentId, input } = job.data;
    this.gateway.server.to(jobId).emit('log', { message: 'Agent run start' });
    const flow = await this.loadFlow(agentId);
    try {
      const chunks = await firstValueFrom(this.engine.runFlow(flow, input).pipe(toArray()));
      for (const chunk of chunks) {
        this.gateway.server.to(jobId).emit('log', { message: chunk });
      }
    } catch (err) {
      this.logger.error(`Agent run failed for job ${jobId}`, err);
      throw err; // allow BullMQ to retry
    }
    await this.taskRunRepo.save({ subscriptionItemId: jobId, taskType: 'agent' });
    this.gateway.server.to(jobId).emit('log', { message: 'Agent run complete' });
  }

  private async loadFlow(agentId: string): Promise<FlowDto> {
    let flow: FlowDto;
    try {
      flow = await this.flows.getDto(agentId);
    } catch (err) {
      if (err instanceof NotFoundException) throw new UnrecoverableError(`Agent ${agentId} not found`);
      throw err;
    }
    if (!flow.nodes.length) throw new UnrecoverableError(`Agent ${agentId} has no flow to run`);
    return flow;
  }
}
