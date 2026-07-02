import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigrationForAllEntities1782471595960 implements MigrationInterface {
  name = 'InitialMigrationForAllEntities1782471595960';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "pinHash" character varying, "pinAttempts" integer NOT NULL DEFAULT '0', "pinLockedUntil" TIMESTAMP, "kycTier" character varying(20) NOT NULL DEFAULT 'basic', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c25bc63d248ca90e8dcc1d92d06" UNIQUE ("tokenHash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "beneficiaries" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "bankName" character varying NOT NULL, "bankCode" character varying(10) NOT NULL, "accountNumber" character varying(10) NOT NULL, "accountName" character varying NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c9356d282dec80f7f12a9eef10a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50064b54d514b72a49e2b7bb57" ON "beneficiaries"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "idempotency_keys" ("id" uuid NOT NULL, "key" character varying NOT NULL, "responseSnapshot" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0afd83cbf08c9d12089a9bffc5" ON "idempotency_keys"  ("key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "rate_locks" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "lockedRate" numeric(18,6) NOT NULL, "lockType" character varying(10) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_83f5afbd00f8e5396a456f6f160" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4c9dfae2ff63d9e37434ca2a8c" ON "rate_locks"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "rate_snapshots" ("id" uuid NOT NULL, "buyRate" numeric(18,6) NOT NULL, "sellRate" numeric(18,6) NOT NULL, "midRate" numeric(18,6) NOT NULL, "source" character varying NOT NULL DEFAULT 'coingecko', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c2223daec9de3f5301315ea4977" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b3371fc777849772071ab8123" ON "rate_snapshots"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "transaction_limits" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "dailyUsedKobo" bigint NOT NULL DEFAULT '0', "lastResetAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a8d83793826afd5c11175df1578" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20935df26f28259a5a7ced195e" ON "transaction_limits"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "type" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "fromCurrency" character varying(10) NOT NULL, "toCurrency" character varying(10) NOT NULL, "fromAmountKobo" bigint NOT NULL, "toAmountKobo" bigint NOT NULL, "rateUsed" numeric(18,6) NOT NULL, "paystackReference" character varying, "paystackStatus" character varying, "beneficiaryId" character varying, "failureReason" text, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bb58f2b6e30cb51a6504599f4" ON "transactions"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8848b4d9d56f3e4a59803c9459" ON "transactions"  ("paystackReference") `,
    );
    await queryRunner.query(
      `CREATE TABLE "wallets" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "currency" character varying(10) NOT NULL, "balanceKobo" bigint NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_01627e643864b58b6e6e6794144" UNIQUE ("userId", "currency"), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "beneficiaries" ADD CONSTRAINT "FK_50064b54d514b72a49e2b7bb574" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_locks" ADD CONSTRAINT "FK_4c9dfae2ff63d9e37434ca2a8c2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_limits" ADD CONSTRAINT "FK_20935df26f28259a5a7ced195e8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_limits" DROP CONSTRAINT "FK_20935df26f28259a5a7ced195e8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_locks" DROP CONSTRAINT "FK_4c9dfae2ff63d9e37434ca2a8c2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "beneficiaries" DROP CONSTRAINT "FK_50064b54d514b72a49e2b7bb574"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8848b4d9d56f3e4a59803c9459"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bb58f2b6e30cb51a6504599f4"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_20935df26f28259a5a7ced195e"`,
    );
    await queryRunner.query(`DROP TABLE "transaction_limits"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8b3371fc777849772071ab8123"`,
    );
    await queryRunner.query(`DROP TABLE "rate_snapshots"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4c9dfae2ff63d9e37434ca2a8c"`,
    );
    await queryRunner.query(`DROP TABLE "rate_locks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0afd83cbf08c9d12089a9bffc5"`,
    );
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50064b54d514b72a49e2b7bb57"`,
    );
    await queryRunner.query(`DROP TABLE "beneficiaries"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
