import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
// Use string reference for relation and inline enum to avoid circular imports
import type { FlowRun, FlowRunStatus } from './flow-run.entity';

@Entity()
export class FlowRunNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('FlowRun', 'nodes', { onDelete: 'CASCADE' })
  run: FlowRun;

  @Column()
  extNodeId: string;

  @Column({ type: 'simple-json', nullable: true })
  output: any;

  @Column({ type: 'simple-enum', enum: ['pending', 'running', 'failed', 'completed'], default: 'pending' })
  status: FlowRunStatus;

  // Durée en ms de l'exécution du nœud
  @Column('int', { nullable: true })
  durationMs: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
