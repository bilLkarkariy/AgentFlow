import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'auth_tokens' })
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  provider: string; // e.g. 'gmail'

  @Column()
  @Index()
  userId: string; // e.g. user email

  @Column('text')
  accessToken: string;

  @Column('text', { nullable: true })
  refreshToken?: string | null;

  @Column({ nullable: true })
  expiresAt?: Date | null;
}
