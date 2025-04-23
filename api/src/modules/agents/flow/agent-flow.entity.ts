import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Agent } from '../agent.entity';
import { AgentFlowNode } from './agent-flow-node.entity';
import { AgentFlowEdge } from './agent-flow-edge.entity';

@Entity()
export class AgentFlow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Agent, (agent) => agent.flows, { onDelete: 'CASCADE' })
  agent: Agent;

  @Column({ default: 1 })
  version: number;

  @Column({ default: '' })
  name: string;

  @OneToMany(() => AgentFlowNode, (n) => n.flow, { cascade: true })
  nodes: AgentFlowNode[];

  @OneToMany(() => AgentFlowEdge, (e) => e.flow, { cascade: true })
  edges: AgentFlowEdge[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
