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

export interface ExecuteAgentJob {
  agentId: string;
  dsl: AgentDsl;
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
  ) {
    super();
  }

  async process(job: Job<ExecuteAgentJob>): Promise<void> {
    const runId = job.id != null ? job.id.toString() : '';
    const { agentId, dsl } = job.data;
    this.logger.log(`Executing agent ${agentId}, run ${runId}`);
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
    });

    // Simple POC: only support Gmail new_email trigger + read_subject action
    if (
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
