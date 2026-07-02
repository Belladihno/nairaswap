import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

@Entity('rate_snapshots')
export class RateSnapshot {
  @PrimaryColumn('uuid')
  id: string = uuidv7();

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  buyRate!: number;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  sellRate!: number;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  midRate!: number;

  @Column({ type: 'varchar', default: 'coingecko' })
  source!: string;

  @Index()
  @CreateDateColumn()
  createdAt!: Date;
}
