import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transaction.entity';
import { TransactionLimit } from './transaction-limit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, TransactionLimit])],
})
export class TransactionsModule {}
