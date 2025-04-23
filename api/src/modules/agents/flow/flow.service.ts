import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../agent.entity';
import { AgentFlow } from './agent-flow.entity';
import { AgentFlowNode } from './agent-flow-node.entity';
import { AgentFlowEdge } from './agent-flow-edge.entity';
import { FlowDto, NodeDto, EdgeDto } from './flow.dto';

@Injectable()
export class FlowService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentFlow)
    private readonly flowRepo: Repository<AgentFlow>,
    @InjectRepository(AgentFlowNode)
    private readonly nodeRepo: Repository<AgentFlowNode>,
    @InjectRepository(AgentFlowEdge)
    private readonly edgeRepo: Repository<AgentFlowEdge>,
  ) {}

  async getOrCreate(agentId: string): Promise<AgentFlow> {
    let flow = await this.flowRepo.findOne({
      where: { agent: { id: agentId } },
      relations: ['nodes', 'edges'],
    });
    if (!flow) {
      const agent = await this.agentRepo.findOne({ where: { id: agentId } });
      if (!agent) throw new NotFoundException('Agent not found');
      flow = await this.flowRepo.save({ agent, name: 'default', version: 1, nodes: [], edges: [] });
    }
    return flow;
  }

  toDto(flow: AgentFlow): FlowDto {
    return {
      nodes: flow.nodes.map<NodeDto>((n) => ({
        id: n.extId,
        type: n.type,
        positionX: n.posX,
        positionY: n.posY,
        data: n.config,
      })),
      edges: flow.edges.map<EdgeDto>((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.label,
      })),
    };
  }

  async getDto(agentId: string): Promise<FlowDto> {
    const flow = await this.getOrCreate(agentId);
    return this.toDto(flow);
  }

  async save(agentId: string, dto: FlowDto): Promise<FlowDto> {
    const flow = await this.getOrCreate(agentId);
    // Remove previous nodes/edges
    await this.nodeRepo.delete({ flow: { id: flow.id } });
    await this.edgeRepo.delete({ flow: { id: flow.id } });

    const nodes = dto.nodes.map((n) =>
      this.nodeRepo.create({
        flow,
        extId: n.id,
        type: n.type,
        posX: n.positionX,
        posY: n.positionY,
        config: n.data,
      }),
    );
    const edges = dto.edges.map((e) =>
      this.edgeRepo.create({
        flow,
        sourceId: e.source,
        targetId: e.target,
        label: e.label,
      }),
    );
    flow.nodes = await this.nodeRepo.save(nodes);
    flow.edges = await this.edgeRepo.save(edges);
    await this.flowRepo.save(flow);
    return this.toDto(flow);
  }
}
