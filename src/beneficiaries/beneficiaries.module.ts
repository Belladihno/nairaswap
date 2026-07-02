import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beneficiary } from './beneficiary.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Beneficiary])],
})
export class BeneficiariesModule {}
