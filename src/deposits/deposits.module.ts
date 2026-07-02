import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyKey } from './idempotency-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKey])],
})
export class DepositsModule {}
