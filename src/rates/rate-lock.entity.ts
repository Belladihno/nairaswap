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
import { LockType } from '../common/enums';

@Entity('rate_locks')
export class RateLock {
  @PrimaryColumn('uuid')
  id: string = uuidv7();

  @Index()
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  lockedRate!: number;

  @Column({ type: 'varchar', length: 10 })
  lockType!: LockType;

  @Column()
  expiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  usedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
