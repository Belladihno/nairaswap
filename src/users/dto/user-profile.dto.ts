import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ example: '0194b5c0-7e2a-7e00-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'John' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;

  @ApiProperty({ example: 'basic', enum: ['basic', 'verified'] })
  kycTier!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-07-02T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-02T12:00:00.000Z' })
  updatedAt!: Date;
}
