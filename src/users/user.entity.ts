import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { KycTier } from '../common/enums';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id: string = uuidv7();

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Index({ unique: true })
  @Column()
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  pinHash!: string | null;

  @Column({ default: 0 })
  pinAttempts!: number;

  @Column({ type: 'timestamp', nullable: true, default: null })
  pinLockedUntil!: Date | null;

  @Column({ type: 'varchar', length: 20, default: KycTier.BASIC })
  kycTier!: KycTier;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail() {
    this.email = this.email.trim().toLowerCase();
  }
}
