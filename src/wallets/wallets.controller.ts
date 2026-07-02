import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { User } from '../users/user.entity';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  async getWallets(@Req() req: Request) {
    const user = req.user as User;
    return this.walletsService.getUserWallets(user.id);
  }
}
