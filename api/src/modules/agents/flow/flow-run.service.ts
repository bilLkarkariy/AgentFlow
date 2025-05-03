import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentFlow } from './agent-flow.entity';
import { FlowRun, FlowRunStatus } from './flow-run.entity';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';

@Injectable()
export class FlowRunService {
  constructor(
    @InjectRepository(AgentFlow)
    private readonly flowRepo: Repository<AgentFlow>,
    @InjectRepository(FlowRun)
    private readonly runRepo: Repository<FlowRun>,
    private readonly rabbitService: RabbitMQService,
  ) {}

  async startRun(agentId: string, input: string): Promise<FlowRun> {
    const flow = await this.flowRepo.findOne({
      where: { agent: { id: agentId } },
      relations: ['agent'],
    });
    if (!flow) throw new NotFoundException('Flow not found');
    const run = this.runRepo.create({ flow, status: FlowRunStatus.PENDING, stats: null });
    const saved = await this.runRepo.save(run);
    await this.rabbitService.publish('flow.run', { runId: saved.id, input, agentId });
    return saved;
  }
}
