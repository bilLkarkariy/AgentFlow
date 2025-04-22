import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column({ nullable: true })
  name?: string;

  @Column('simple-array', { default: '' })
  roles: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  organizationId?: string;

  @Column({ nullable: true })
  timeZone?: string;

  @Column({ nullable: true })
  locale?: string;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn({ default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
