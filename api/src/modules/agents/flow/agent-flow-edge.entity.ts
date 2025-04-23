import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
} from 'typeorm';
import { AgentFlow } from './agent-flow.entity';

@Entity()
export class AgentFlowEdge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AgentFlow, (f) => f.edges, { onDelete: 'CASCADE' })
  flow: AgentFlow;

  @Column()
  sourceId: string;

  @Column()
  targetId: string;

  @Column({ nullable: true })
  label: string;
}
