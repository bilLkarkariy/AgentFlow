import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
} from 'typeorm';
import { AgentFlow } from './agent-flow.entity';

@Entity()
export class AgentFlowNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AgentFlow, (f) => f.nodes, { onDelete: 'CASCADE' })
  flow: AgentFlow;

  // ID used by frontend (React Flow)
  @Column()
  extId: string;

  @Column()
  type: string;

  @Column({ type: 'simple-json', nullable: true })
  config: Record<string, any>;

  @Column('float')
  posX: number;

  @Column('float')
  posY: number;
}
