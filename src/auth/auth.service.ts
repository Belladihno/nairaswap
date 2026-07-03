import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, IsNull } from 'typeorm';
import ms from 'ms';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { Wallet } from '../wallets/wallet.entity';
import { User } from '../users/user.entity';
import { RefreshToken } from './refresh-token.entity';
import { Currency } from '../common/enums';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const { user } = await this.dataSource.transaction(
        async (manager: EntityManager) => {
          const user = await manager.save(User, {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            passwordHash,
          });

          await manager.save(Wallet, [
            { userId: user.id, currency: Currency.NGN, balanceMinorUnits: 0 },
            { userId: user.id, currency: Currency.USDT, balanceMinorUnits: 0 },
          ]);

          return { user };
        },
      );

      const tokens = await this.generateTokens(user.id, dto.email);
      return { user, ...tokens };
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    return { user, ...tokens };
  }

  async refresh(refreshTokenStr: string) {
    const tokenHash = this.hashToken(refreshTokenStr);
    const refreshToken = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!refreshToken || refreshToken.revokedAt) {
      if (refreshToken?.revokedAt) {
        await this.revokeAllUserTokens(refreshToken.userId);
      }
      throw new ForbiddenException('Invalid refresh token');
    }

    if (refreshToken.expiresAt < new Date()) {
      throw new ForbiddenException('Refresh token expired');
    }

    await this.refreshTokensRepository.update(refreshToken.id, {
      revokedAt: new Date(),
    });

    if (!refreshToken.user) {
      throw new ForbiddenException('User not found');
    }

    return this.generateTokens(refreshToken.userId, refreshToken.user.email);
  }

  async logout(refreshTokenStr: string) {
    const tokenHash = this.hashToken(refreshTokenStr);
    const token = await this.refreshTokensRepository.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });
    if (token) {
      token.revokedAt = new Date();
      await this.refreshTokensRepository.save(token);
    }
  }

  private async generateTokens(userId: string, email: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      {
        secret: this.configService.get<string>(
          'ACCESS_TOKEN_SECRET',
          'fallback-secret',
        ),
        expiresIn: 900,
      },
    );

    const refreshTokenStr = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(refreshTokenStr);

    const expiresInMs = this.parseExpiry(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRY', '7d'),
    );

    await this.refreshTokensRepository.insert({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + expiresInMs),
    });

    return { accessToken, refreshToken: refreshTokenStr };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async revokeAllUserTokens(userId: string) {
    const tokens = await this.refreshTokensRepository.find({
      where: { userId, revokedAt: IsNull() },
    });
    for (const token of tokens) {
      token.revokedAt = new Date();
    }
    await this.refreshTokensRepository.save(tokens);
  }

  private parseExpiry(value: string): number {
    const result = ms(value as ms.StringValue);
    return typeof result === 'number' ? result : 7 * 86400 * 1000;
  }
}
