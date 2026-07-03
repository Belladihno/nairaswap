import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Registered email address',
  })
  @Transform(({ value }: { value?: string }) => value?.trim().toLowerCase())
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'securePassword123',
    description: 'Account password',
  })
  @IsString()
  password!: string;
}
