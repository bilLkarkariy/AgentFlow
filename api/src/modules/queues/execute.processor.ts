import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { GmailService } from '../gmail/gmail.service';
import { AgentDsl } from '../agents/dsl-parser.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskRun } from '../tasks/task-run.entity';
import { FlowGateway } from '../agents/flow/flow.gateway';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';

export interface ExecuteAgentJob {
  agentId: string;
  dsl: AgentDsl;
  taskType?: 'flow' | 'agent';
}

export const EXECUTE_AGENT_JOB = 'execute-agent';

@Processor('agents')
export class ExecuteProcessor extends WorkerHost {
  private readonly logger = new Logger(ExecuteProcessor.name);

  constructor(
    private readonly gmail: GmailService,
    @InjectRepository(TaskRun)
    private readonly taskRunRepo: Repository<TaskRun>,
    private readonly gateway: FlowGateway,
    private readonly rabbit: RabbitMQService,
    private readonly agentRuntime: AgentRuntimeService,
  ) {
    super();
  }

  async process(job: Job<ExecuteAgentJob>): Promise<void> {
    const runId = job.id?.toString() ?? '';
    const { agentId, dsl, taskType = 'flow' } = job.data;
    this.logger.log(`Executing ${taskType} for agent ${agentId}, run ${runId}`);
    // notify start
    this.gateway?.server?.to(runId).emit('log', {
      runId,
      nodeId: 'start',
      status: 'info',
      timestamp: Date.now(),
      message: 'Execution started',
    });

    // Record execution for billing quotas
    await this.taskRunRepo.save({
      subscriptionItemId: agentId,
      executedAt: new Date(),
      taskType,
    });

    // Route to agent runtime if needed
    if (taskType === 'agent') {
      this.logger.log('Routing to AgentRuntimeService');
      this.gateway.server?.to(runId).emit('log', {
        runId,
        nodeId: 'grpc_start',
        status: 'info',
        timestamp: Date.now(),
        message: 'Agent runtime start',
      });
      const results = await this.agentRuntime.run(JSON.stringify(dsl), {});
      for (const message of results) {
        this.gateway.server?.to(runId).emit('log', {
          runId,
          nodeId: 'grpc_response',
          status: 'info',
          timestamp: Date.now(),
          message,
        });
      }
    } else if (
      dsl.trigger?.type === 'gmail.new_email' &&
      dsl.action?.type === 'gmail.read_subject'
    ) {
      this.logger.log(
        `Reading last email subject from ${dsl.trigger.filter.from}`
      );
      this.gateway?.server?.to(runId).emit('log', {
        runId,
        nodeId: 'read_subject_start',
        status: 'info',
        timestamp: Date.now(),
        message: `Lecture du sujet de ${dsl.trigger.filter.from}`,
      });
      const subject = await this.gmail.getLatestEmailSubject(
        dsl.trigger.filter.from
      );
      this.gateway?.server?.to(runId).emit('log', {
        runId,
        nodeId: 'read_subject',
        status: 'info',
        timestamp: Date.now(),
        message: subject,
      });
      // Publish email received event
      this.rabbit.publish('email.received', {
        runId,
        from: dsl.trigger.filter.from,
        subject,
      });
    } else {
      this.logger.warn(`Unsupported DSL for agent ${agentId}`);
      this.gateway?.server?.to(runId).emit('log', {
        runId,
        nodeId: 'execute',
        status: 'warn',
        timestamp: Date.now(),
        message: 'Unsupported DSL',
      });
    }
    // notify finish
    this.gateway?.server?.to(runId).emit('log', {
      runId,
      nodeId: 'end',
      status: 'success',
      timestamp: Date.now(),
      message: 'Execution finished',
    });
  }
}
