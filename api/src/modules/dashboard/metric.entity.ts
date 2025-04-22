import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('metrics')
export class Metric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', unique: true })
  @Index()
  date: string;

  @Column({ type: 'int' })
  executionsCount: number;

  @Column({ type: 'int' })
  timeSavedMinutes: number;
}
