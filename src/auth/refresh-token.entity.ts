import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { User } from '../users/user.entity';

@Entity('refresh_tokens')
@Index(['userId', 'revokedAt'])
export class RefreshToken {
  @PrimaryColumn('uuid')
  id: string = uuidv7();

  @Index()
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ unique: true })
  tokenHash!: string;

  @Column()
  expiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  revokedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
