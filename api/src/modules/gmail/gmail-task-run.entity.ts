import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class GmailTaskRun {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'success' | 'failed';

  @Column({ type: 'json', nullable: true })
  result: any;

  @Column({ type: 'text', nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
