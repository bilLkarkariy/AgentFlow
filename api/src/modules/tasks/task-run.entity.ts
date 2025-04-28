import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity()
export class TaskRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Stripe subscription item id for metered usage
  @Column()
  @Index()
  subscriptionItemId: string;

  // When the task was executed (auto timestamp)
  @CreateDateColumn({
    default: () => 'CURRENT_TIMESTAMP',
  })
  executedAt: Date;

  @Column({ type: 'varchar', default: 'flow' })
  taskType: 'flow' | 'agent';
}
