import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Agent } from '../agents/agent.entity';

@Entity()
export class HubspotTrigger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Agent, agent => agent.id, { nullable: false, onDelete: 'CASCADE' })
  agent: Agent;

  /**
   * Raw HubSpot subscription event type, e.g. "contact.propertyChange", "deal.creation".
   */
  @Column()
  eventType: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
