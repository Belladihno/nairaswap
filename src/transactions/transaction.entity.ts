import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { User } from '../users/user.entity';
import { TransactionType, TransactionStatus } from '../common/enums';

@Entity('transactions')
export class Transaction {
  @PrimaryColumn('uuid')
  id: string = uuidv7();

  @Index()
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 20 })
  type!: TransactionType;

  @Column({ type: 'varchar', length: 20, default: TransactionStatus.PENDING })
  status!: TransactionStatus;

  @Column({ type: 'varchar', length: 10 })
  fromCurrency!: string;

  @Column({ type: 'varchar', length: 10 })
  toCurrency!: string;

  @Column({ type: 'bigint' })
  fromAmountKobo!: number;

  @Column({ type: 'bigint' })
  toAmountKobo!: number;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  rateUsed!: number;

  @Index()
  @Column({ type: 'varchar', nullable: true, default: null })
  paystackReference!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  paystackStatus!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  beneficiaryId!: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  failureReason!: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  completedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
