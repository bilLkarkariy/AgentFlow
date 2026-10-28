import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { FlowRun, FlowRunStatus } from './flow-run.entity';
import { FlowRunNode } from './flow-run-node.entity';
import { FlowService } from './flow.service';
import { FlowEngineService } from '../../agent-runtime/flow-engine.service';
import { PricingService } from '../../pricing/pricing.service';

/** Display-only conversion for the historical `euros` stat key. */
const USD_TO_EUR = 0.92;

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
    private readonly pricing: PricingService,
  ) {}

  onModuleInit() {
    // Durable shared queue: a run is executed by a single api replica.
    this.rabbitService.subscribe('flow.run', this.handleRun.bind(this), {
      queue: 'agentflow.flow-run',
    });
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

    const model = this.pricing.normalizeModel(
      (flowDto.nodes[0] as any)?.model,
    );
    let tokenCount = 0;

    this.flowEngineService.runFlow(flowDto, input).subscribe({
      next: async (token: string) => {
        tokenCount++;
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
        const usd = this.pricing.costFor(model, tokenCount);
        run.stats = {
          tokens: tokenCount,
          model,
          usd,
          // kept for the dashboard UI, which still reads `euros`
          euros: usd * USD_TO_EUR,
        };
        await this.runRepo.save(run);
      },
    });
  }
}
