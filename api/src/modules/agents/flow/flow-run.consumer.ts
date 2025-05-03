import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { FlowRun, FlowRunStatus } from './flow-run.entity';
import { FlowRunNode } from './flow-run-node.entity';
import { FlowService } from './flow.service';
import { FlowEngineService } from '../../agent-runtime/flow-engine.service';
import pricing from '../../../pricing.json';

@Injectable()
export class FlowRunConsumer implements OnModuleInit {
  constructor(
    private readonly rabbitService: RabbitMQService,
    @InjectRepository(FlowRun)
    private readonly runRepo: Repository<FlowRun>,
    @InjectRepository(FlowRunNode)
    private readonly runNodeRepo: Repository<FlowRunNode>,
    private readonly flowService: FlowService,
    private readonly flowEngineService: FlowEngineService,
  ) {}

  onModuleInit() {
    this.rabbitService.subscribe('flow.run', this.handleRun.bind(this));
  }

  private async handleRun(payload: { runId: string; input: any; agentId: string }) {
    const { runId, input, agentId } = payload;
    const run = await this.runRepo.findOne({ where: { id: runId }, relations: ['flow'] });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    run.status = FlowRunStatus.RUNNING;
    await this.runRepo.save(run);

    // Récupérer la définition du flow
    const flowDto = await this.flowService.getDto(agentId);

    // Déterminer le nœud racine (celui sans target)
    const nodeIds = flowDto.nodes.map(n => n.id);
    const targetIds = flowDto.edges.map(e => e.target);
    const rootId = nodeIds.find(id => !targetIds.includes(id)) || nodeIds[0];

    let tokenCount = 0;
    let eurosTotal = 0;

    this.flowEngineService.runFlow(flowDto, input).subscribe({
      next: async (token: string) => {
        tokenCount++;
        eurosTotal += pricing.default;
        const nodeEntry = this.runNodeRepo.create({
          run,
          extNodeId: rootId,
          output: token,
          status: FlowRunStatus.COMPLETED,
          durationMs: null,
        });
        await this.runNodeRepo.save(nodeEntry);
      },
      error: async () => {
        run.status = FlowRunStatus.FAILED;
        await this.runRepo.save(run);
      },
      complete: async () => {
        run.status = FlowRunStatus.COMPLETED;
        run.stats = { tokens: tokenCount, euros: eurosTotal };
        await this.runRepo.save(run);
      },
    });
  }
}
