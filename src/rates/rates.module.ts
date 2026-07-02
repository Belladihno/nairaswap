import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RateSnapshot } from './rate-snapshot.entity';
import { RateLock } from './rate-lock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RateSnapshot, RateLock])],
})
export class RatesModule {}
