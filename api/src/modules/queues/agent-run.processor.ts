import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FlowGateway } from '../agents/flow/flow.gateway';
import { TaskRun } from '../tasks/task-run.entity';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';

@Processor('agent-run')
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);

  constructor(
    private readonly agentRuntime: AgentRuntimeService,
    @InjectRepository(TaskRun) private taskRunRepo: Repository<TaskRun>,
    private readonly gateway: FlowGateway,
  ) {
    super();
  }

  async process(job: Job<{ flowId: string; nodeId: string; input: any }>): Promise<void> {
    const runId = job.id?.toString() ?? '';
    this.logger.log(`Starting agent-run job ${runId}`);
    this.gateway.server?.to(runId).emit('log', {
      runId,
      nodeId: job.data.nodeId,
      status: 'info',
      timestamp: Date.now(),
      message: 'Agent run start',
    });

    // run agent via AgentRuntimeService
    const chunks = await this.agentRuntime.run(job.data.flowId, job.data.input);
    for (const text of chunks) {
      this.gateway.server?.to(runId).emit('log', {
        runId,
        nodeId: job.data.nodeId,
        status: 'info',
        timestamp: Date.now(),
        message: text,
      });
    }

    await this.taskRunRepo.save({ subscriptionItemId: runId, executedAt: new Date() });
    this.gateway.server?.to(runId).emit('log', {
      runId,
      nodeId: job.data.nodeId,
      status: 'success',
      timestamp: Date.now(),
      message: 'Agent run complete',
    });
  }
}
// Removed unused import to fix lint
// Removed unused interfaces to fix lint
