import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgentFlow } from './agent-flow.entity';
import { FlowRunNode } from './flow-run-node.entity';

export enum FlowRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  FAILED = 'failed',
  COMPLETED = 'completed',
}

@Entity()
export class FlowRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AgentFlow, (flow) => flow.runs, { onDelete: 'CASCADE' })
  flow: AgentFlow;

  @Column({ type: 'simple-enum', enum: FlowRunStatus, default: FlowRunStatus.PENDING })
  status: FlowRunStatus;

  @OneToMany(() => FlowRunNode, (node) => node.run, { cascade: true })
  nodes: FlowRunNode[];

  @Column({ type: 'simple-json', nullable: true })
  stats: { tokens: number; euros: number };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
