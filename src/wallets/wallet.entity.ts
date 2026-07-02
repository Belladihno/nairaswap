import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { User } from '../users/user.entity';
import { Currency } from '../common/enums';

@Entity('wallets')
@Unique(['userId', 'currency'])
export class Wallet {
  @PrimaryColumn('uuid')
  id: string = uuidv7();

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 10 })
  currency!: Currency;

  @Column({ type: 'bigint', default: 0 })
  balanceMinorUnits!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
