import { ApiProperty } from '@nestjs/swagger';

class UserResponse {
  @ApiProperty({ example: '0194b5c0-7e2a-7e00-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'John' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;

  @ApiProperty({ example: 'basic' })
  kycTier!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-07-02T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-02T12:00:00.000Z' })
  updatedAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponse })
  user!: UserResponse;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    example: 'a1b2c3d4e5f6...',
    description:
      'Refresh token — send to /auth/refresh to get a new access token',
  })
  refreshToken!: string;
}

export class TokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    example: 'a1b2c3d4e5f6...',
  })
  refreshToken!: string;
}
