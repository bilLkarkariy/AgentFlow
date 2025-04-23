import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { AgentDsl } from './dsl-parser.service';
import { AgentFlow } from './flow/agent-flow.entity';

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

  @OneToMany(() => AgentFlow, (f) => f.agent)
  flows: AgentFlow[];
}
