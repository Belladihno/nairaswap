import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { User } from '../users/user.entity';
import { WalletsService } from './wallets.service';
import { WalletDto } from './dto/wallet.dto';

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get wallets',
    description:
      'Returns NGN and USDT wallet balances for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Wallet list', type: [WalletDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWallets(@Req() req: Request) {
    const user = req.user as User;
    return this.walletsService.getUserWallets(user.id);
  }
}
