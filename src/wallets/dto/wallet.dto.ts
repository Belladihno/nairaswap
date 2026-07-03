import { ApiProperty } from '@nestjs/swagger';

export class WalletDto {
  @ApiProperty({ example: '0194b5c0-7e2a-7e00-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: '0194b5c0-7e2a-7e00-8000-000000000001' })
  userId!: string;

  @ApiProperty({ example: 'NGN', enum: ['NGN', 'USDT'] })
  currency!: string;

  @ApiProperty({
    example: 1500000,
    description:
      'Balance in minor units — divide by 100 for NGN, by 1,000,000 for USDT',
  })
  balanceMinorUnits!: number;

  @ApiProperty({ example: '2026-07-02T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-02T12:00:00.000Z' })
  updatedAt!: Date;
}
