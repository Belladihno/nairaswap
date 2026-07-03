import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from './wallet.entity';
import { Currency } from '../common/enums';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  async createWallets(userId: string): Promise<Wallet[]> {
    const existing = await this.walletsRepository.find({
      where: { userId },
    });

    const existingCurrencies = new Set(existing.map((w) => w.currency));
    const missing = [Currency.NGN, Currency.USDT].filter(
      (c) => !existingCurrencies.has(c),
    );

    if (missing.length === 0) return existing;

    try {
      const wallets = this.walletsRepository.create(
        missing.map((currency) => ({
          userId,
          currency,
          balanceMinorUnits: 0,
        })),
      );

      return await this.walletsRepository.save(wallets);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        return this.walletsRepository.find({ where: { userId } });
      }
      throw err;
    }
  }

  async findByUserAndCurrency(
    userId: string,
    currency: Currency,
  ): Promise<Wallet | null> {
    return this.walletsRepository.findOne({
      where: { userId, currency },
    });
  }

  async getUserWallets(userId: string): Promise<Wallet[]> {
    return this.walletsRepository.find({
      where: { userId },
      order: { currency: 'ASC' },
    });
  }

  async credit(
    userId: string,
    currency: Currency,
    amount: number,
  ): Promise<Wallet> {
    if (amount <= 0) {
      throw new BadRequestException('Credit amount must be positive');
    }
    return this.updateBalance(userId, currency, amount);
  }

  async debit(
    userId: string,
    currency: Currency,
    amount: number,
  ): Promise<Wallet> {
    if (amount <= 0) {
      throw new BadRequestException('Debit amount must be positive');
    }
    return this.updateBalance(userId, currency, -amount);
  }

  private async updateBalance(
    userId: string,
    currency: Currency,
    amount: number,
  ): Promise<Wallet> {
    if (!Number.isInteger(amount)) {
      throw new BadRequestException('Amount must be an integer (minor units)');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager
        .createQueryBuilder(Wallet, 'wallet')
        .setLock('pessimistic_write')
        .where('wallet.userId = :userId AND wallet.currency = :currency', {
          userId,
          currency,
        })
        .getOne();

      if (!wallet) {
        throw new BadRequestException('Wallet not found');
      }

      if (amount < 0 && BigInt(wallet.balanceMinorUnits) < BigInt(-amount)) {
        throw new BadRequestException('Insufficient balance');
      }

      await queryRunner.manager.increment(
        Wallet,
        { id: wallet.id },
        'balanceMinorUnits',
        amount,
      );

      const updated = await queryRunner.manager.findOneBy(Wallet, {
        id: wallet.id,
      });

      await queryRunner.commitTransaction();

      return updated!;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof BadRequestException) throw error;

      this.logger.error(
        `Failed to update balance for user ${userId} / ${currency}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      throw new InternalServerErrorException('Failed to update balance');
    } finally {
      await queryRunner.release();
    }
  }
}
