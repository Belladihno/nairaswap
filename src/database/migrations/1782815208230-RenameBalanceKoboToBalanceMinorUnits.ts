import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameBalanceKoboToBalanceMinorUnits1782815208230 implements MigrationInterface {
    name = 'RenameBalanceKoboToBalanceMinorUnits1782815208230'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" RENAME COLUMN "balanceKobo" TO "balanceMinorUnits"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" RENAME COLUMN "balanceMinorUnits" TO "balanceKobo"`);
    }

}
