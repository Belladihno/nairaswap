import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  @Get('me')
  getProfile(@Req() req: Request): User {
    return req.user as User;
  }
}
