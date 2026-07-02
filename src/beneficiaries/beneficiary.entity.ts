import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { User } from '../users/user.entity';

@Entity('beneficiaries')
export class Beneficiary {
  @PrimaryColumn('uuid')
  id: string = uuidv7();

  @Index()
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column()
  bankName!: string;

  @Column({ length: 10 })
  bankCode!: string;

  @Column({ length: 10 })
  accountNumber!: string;

  @Column()
  accountName!: string;

  @Column({ default: false })
  isDefault!: boolean;

  @DeleteDateColumn()
  deletedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
