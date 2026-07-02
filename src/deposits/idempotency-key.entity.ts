import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn('uuid')
  id: string = uuidv7();

  @Index({ unique: true })
  @Column()
  key!: string;

  @Column({ type: 'jsonb', nullable: true, default: null })
  responseSnapshot!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @Column()
  expiresAt!: Date;
}
