import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from './wallet.entity';
import { Currency } from '../common/enums';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  async createWallets(userId: string): Promise<Wallet[]> {
    const existing = await this.walletsRepository.find({
      where: { userId },
    });
    if (existing.length >= 2) return existing;

    try {
      const wallets = this.walletsRepository.create(
        [Currency.NGN, Currency.USDT].map((currency) => ({
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

  async updateBalance(
    userId: string,
    currency: Currency,
    amount: number,
  ): Promise<Wallet> {
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

      const newBalance = Number(wallet.balanceMinorUnits) + amount;

      if (newBalance < 0) {
        throw new BadRequestException('Insufficient balance');
      }

      await queryRunner.manager.update(
        Wallet,
        { id: wallet.id },
        { balanceMinorUnits: newBalance },
      );

      await queryRunner.commitTransaction();

      return { ...wallet, balanceMinorUnits: newBalance };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to update balance');
    } finally {
      await queryRunner.release();
    }
  }
}
