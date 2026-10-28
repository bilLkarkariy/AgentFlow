import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { defer } from 'rxjs';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { FlowRun, FlowRunStatus } from './flow-run.entity';
import { FlowRunNode } from './flow-run-node.entity';
import { FlowService } from './flow.service';
import { FlowEngineService } from '../../agent-runtime/flow-engine.service';
import { PricingService } from '../../pricing/pricing.service';
import { FlowLogEvent, FlowLogsGateway } from '../../flow-logs/flow-logs.gateway';

/** Display-only conversion for the historical `euros` stat key. */
const USD_TO_EUR = 0.92;

/** `nodeId` of the log entries that describe the whole run. */
export const RUN_LOG_NODE_ID = 'run';

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
    private readonly flowLogs: FlowLogsGateway,
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
    this.log(runId, RUN_LOG_NODE_ID, 'info', 'Exécution démarrée');

    // Récupérer la définition du flow
    const flowDto = await this.flowService.getDto(agentId);

    // Déterminer le nœud racine (celui sans target)
    const nodeIds = flowDto.nodes.map(n => n.id);
    const targetIds = flowDto.edges.map(e => e.target);
    const rootId = nodeIds.find(id => !targetIds.includes(id)) || nodeIds[0];

    const model = this.pricing.normalizeModel(flowDto.nodes[0]?.data?.model);
    let tokenCount = 0;
    let output = '';

    // defer: a payload the runner schema rejects fails the run instead of
    // throwing here and leaving it `running`.
    defer(() => this.flowEngineService.runFlow(flowDto, input)).subscribe({
      next: async (token: string) => {
        tokenCount++;
        output += token;
        this.flowLogs.emitToken(runId, token);
        const nodeEntry = this.runNodeRepo.create({
          run,
          extNodeId: rootId,
          output: token,
          status: FlowRunStatus.COMPLETED,
          durationMs: null,
        });
        await this.runNodeRepo.save(nodeEntry);
      },
      error: async (err: unknown) => {
        run.status = FlowRunStatus.FAILED;
        await this.runRepo.save(run);
        const reason = err instanceof Error ? err.message : String(err);
        this.log(runId, RUN_LOG_NODE_ID, 'error', `Échec de l'exécution : ${reason}`);
        this.flowLogs.endRun(runId);
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
        if (output) this.log(runId, rootId, 'success', output);
        this.log(runId, RUN_LOG_NODE_ID, 'success', `Exécution terminée · ${tokenCount} jetons`);
        this.flowLogs.endRun(runId);
      },
    });
  }

  private log(runId: string, nodeId: string, status: FlowLogEvent['status'], message: string) {
    this.flowLogs.emitLog({ runId, nodeId, status, timestamp: Date.now(), message });
  }
}
