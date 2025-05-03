import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'webhook_triggers' })
export class WebhookTrigger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  secret: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
