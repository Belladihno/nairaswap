import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompositeIndexToRefreshTokens1782474859528 implements MigrationInterface {
  name = 'AddCompositeIndexToRefreshTokens1782474859528';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_070d648bde98d061fd6e9d176d" ON "refresh_tokens"  ("userId", "revokedAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_070d648bde98d061fd6e9d176d"`,
    );
  }
}
