import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AgentDsl } from './dsl-parser.service';

@Entity({ name: 'agents' })
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'simple-json', nullable: true })
  dsl: AgentDsl;

  @Column({ default: true })
  active: boolean;
}
