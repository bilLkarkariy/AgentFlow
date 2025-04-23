import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Agent } from '../agents/agent.entity';

@Entity()
@Index(['agent'], { unique: true })
export class HubspotCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column()
  accessToken: string;

  @Column()
  refreshToken: string;

  @Column({ type: (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) ? 'datetime' : 'timestamptz' })
  expiresAt: Date;

  @Column()
  scope: string;
}
