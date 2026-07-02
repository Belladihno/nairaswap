# NairaSwap — Build Plan

## Phase 1 — Project Setup
- Install all production and dev dependencies (pnpm)
- Configure `.env` with all environment variables (DATABASE_URL, REDIS_URL, JWT secrets, Paystack keys, CoinGecko URL, rate config)
- Set up `@nestjs/config` globally
- Configure TypeORM with PostgreSQL in `app.module.ts`
- Configure Redis via `ioredis`
- Configure BullMQ with Redis connection
- Enable global `ValidationPipe` in `main.ts`
- Enable `RawBodyMiddleware` for the `/deposits/webhook` route
- Keep the NestJS scaffold structure, strip default boilerplate

## Phase 2 — Database Entities & Migrations
- Create all 9 TypeORM entities:
  - **User** — id (UUID v7), firstName, lastName, email, passwordHash, pinHash, pinAttempts, pinLockedUntil, kycTier, isActive, timestamps
  - **RefreshToken** — id, userId (FK), tokenHash, expiresAt, revokedAt, createdAt
  - **Wallet** — id, userId (FK), currency (NGN/USDT), balanceKobo (BIGINT), timestamps
  - **RateSnapshot** — id, buyRate, sellRate, midRate, source, createdAt
  - **Transaction** — id, userId (FK), type, status, fromCurrency, toCurrency, fromAmountKobo, toAmountKobo, rateUsed, paystackReference, paystackStatus, beneficiaryId (FK), failureReason, completedAt, timestamps
  - **RateLock** — id, userId (FK), lockedRate, lockType (buy/sell), expiresAt, usedAt, createdAt
  - **Beneficiary** — id, userId (FK), bankName, bankCode, accountNumber, accountName, isDefault, deletedAt (soft delete), timestamps
  - **IdempotencyKey** — id, key (unique), responseSnapshot (JSONB), createdAt, expiresAt
  - **TransactionLimit** — id, userId (FK), dailyUsedKobo, lastResetAt, timestamps
- Run initial migration to create all tables
- Confirm all tables in PostgreSQL

## Phase 3 — Auth Module
- **UsersModule**: User entity, UsersService (create user, findByEmail, findById), UsersRepository
- **AuthModule**:
  - `POST /auth/register` — validate email uniqueness, hash password, create user, auto-create NGN + USDT wallets, issue tokens
  - `POST /auth/login` — verify password, issue access + refresh tokens
  - `POST /auth/refresh` — validate refresh token from cookie, rotate (revoke old, issue new pair)
  - `POST /auth/logout` — revoke refresh token
- JWT strategy (passport-jwt) for access token verification
- `JwtAuthGuard` — global guard
- `@Public()` decorator to bypass auth on specific routes
- Refresh token rotation with theft detection (revoked token reuse → revoke all user tokens)

## Phase 4 — Wallets Module
- Wallet entity with NGN (kobo) and USDT (micro-units) balance fields
- Auto-create NGN + USDT wallets on user registration (hook from AuthService)
- `GET /wallets` — return both wallet balances
- Core `updateBalance` method using `SELECT ... FOR UPDATE` inside a TypeORM `QueryRunner` transaction
- Ensure no direct balance mutations outside the locked method

## Phase 5 — Transaction PIN
- Add PIN fields to User entity: pinHash, pinAttempts, pinLockedUntil
- `POST /users/pin/setup` — set 4-digit PIN for first time (bcrypt hashed)
- `PATCH /users/pin/change` — change existing PIN (requires current PIN)
- `PATCH /users/password` — change login password
- `UsersService.verifyPin(userId, pin)` — validate PIN with lockout logic:
  - If pinLockedUntil > now → reject with remaining lockout time
  - bcrypt.compare → fail → increment pinAttempts → if >= 3 → lock for 15 minutes
  - Success → reset pinAttempts to 0
- **PinGuard** — NestJS guard that reads `x-transaction-pin` header, calls verifyPin, throws `ForbiddenException` on failure
- Apply PinGuard to money-movement endpoints

## Phase 6 — Rates Module
- CoinGecko fetch via `@nestjs/axios` — get USDT/NGN rate from free API
- Spread calculation:
  - midRate = raw CoinGecko rate
  - buyRate = midRate × (1 + spreadPercent / 100)
  - sellRate = midRate × (1 - spreadPercent / 100)
- Redis caching: store { buyRate, sellRate, midRate } with 3-minute TTL
  - On request: check Redis first → if miss, fetch CoinGecko → apply spread → cache → return
  - Also save snapshot to `rate_snapshots` table for chart history
  - If CoinGecko unreachable → fallback to latest DB snapshot, log warning
- `GET /rates/current` — return current buy/sell/mid rates
- `POST /rates/lock` — lock rate for user for 5 minutes:
  - Fetch current buy/sell rate
  - Invalidate any previous unused lock for this user
  - Create `rate_lock` record with expiresAt = now + 5 minutes
  - Return lockId to client
- `GET /rates/chart?period=24h|7d|30d` — aggregated rate snapshots for charting

## Phase 7 — Deposits Module
- `POST /deposits/initiate` (PIN required):
  - Validate amount (min ₦1,000, max ₦500,000)
  - Generate unique Paystack reference (UUID v7)
  - Create pending transaction record
  - Call Paystack Initialize Transaction API (amount in kobo, email, reference, callback URL)
  - Return authorization URL to frontend
- `POST /deposits/webhook` (public, raw body):
  - Read `x-paystack-signature` header
  - Compute HMAC-SHA512 of raw body using Paystack secret key
  - Compare — if mismatch → return 401
  - Parse event — only process `charge.success`
  - Check `idempotency_keys` table by Paystack reference → if exists, return 200 (idempotent)
  - Find pending transaction by reference
  - Within DB transaction:
    - Credit user's NGN wallet (locked SELECT FOR UPDATE)
    - Update transaction status to 'completed'
    - Insert into idempotency_keys
  - Return 200

## Phase 8 — Swaps Module (Buy USDT)
- `POST /swaps/buy` (PIN required):
  - Validate rate lock:
    - Exists, not expired (expiresAt > now), not used (usedAt IS NULL), belongs to authenticated user
  - Check NGN balance ≥ fromAmount (via locked wallet query)
  - Check daily limit: current dailyUsedKobo + fromAmount ≤ user's KYC tier limit
  - Execute atomic swap in single QueryRunner transaction:
    1. Lock NGN wallet with `SELECT ... FOR UPDATE`
    2. Deduct NGN (fromAmountKobo)
    3. Lock USDT wallet with `SELECT ... FOR UPDATE`
    4. Credit USDT (toAmountKobo)
    5. Create completed transaction record
    6. Update transaction_limits.dailyUsedKobo
    7. Mark rate lock as used (usedAt = now)
    8. Commit — all or nothing

## Phase 9 — Off-Ramp Module (Sell USDT)
- `POST /offramp/initiate` (PIN required):
  - Validate rate lock (sell type)
  - Validate beneficiary exists and belongs to user
  - Check USDT balance ≥ fromAmount
  - Check daily limit
  - Atomically:
    1. Lock USDT wallet with `SELECT ... FOR UPDATE`
    2. Deduct USDT
    3. Create transaction record with status 'processing'
    4. Update daily limit
    5. Mark rate lock as used
    6. Commit
  - Enqueue BullMQ payout job (transactionId)
  - Return { status: 'processing', transactionId }
- **PayoutProcessor** (BullMQ worker):
  - Fetch transaction by ID
  - Verify status is still 'processing' (guard against double execution)
  - Simulate 3-5 second bank transfer delay
  - Mark transaction as 'completed', set completedAt
  - Enqueue notification job
  - On failure → mark as 'failed', set failureReason, enqueue refund job
- **RefundProcessor** (BullMQ worker):
  - Fetch failed transaction
  - Lock user's USDT wallet with `SELECT ... FOR UPDATE`
  - Credit back deducted USDT
  - Create refund transaction record linked to original
  - Enqueue notification
- **NotificationProcessor**: stub — record in DB for now
- Job config: 3 retries with exponential backoff (1s, 5s, 30s)

## Phase 10 — Beneficiaries Module
- `POST /beneficiaries` — add bank account:
  - Validate: accountNumber = 10 digits (NUBAN), bankCode in valid list, max 5 per user, no duplicate account numbers
  - Save with accountName (resolved name)
- `GET /beneficiaries` — list user's accounts (exclude soft-deleted)
- `PATCH /beneficiaries/:id/default` — set one as default (unset others)
- `DELETE /beneficiaries/:id` — soft delete (set deletedAt)
- Wire beneficiary selection into off-ramp flow

## Phase 11 — Transactions Module
- `GET /transactions` — paginated list with optional filters (type, status, date range)
- `GET /transactions/:id` — single transaction detail with all fields
- `GET /transactions/:id/receipt` — structured receipt JSON (transaction ID, type, status, amounts, rate, date, beneficiary)

## Phase 12 — Price Chart & Portfolio
- `GET /rates/chart?period=24h|7d|30d`:
  - 24h: all snapshots in last 24 hours
  - 7d: hourly averages (GROUP BY hour)
  - 30d: daily averages (GROUP BY date)
- `GET /wallets/portfolio`:
  - USDT balance + current buy rate + NGN value + NGN balance + total portfolio NGN value

## Phase 13 — Admin Module
- Add `isAdmin` boolean field to User entity
- `AdminGuard` — checks `req.user.isAdmin === true`
- `GET /admin/users` — list all users with wallet balances
- `GET /admin/transactions` — all platform transactions
- `PATCH /admin/rates/override` — manually set buyRate/sellRate
- `PATCH /admin/users/:id/kyc` — upgrade user KYC tier

## Phase 14 — Daily Limit Reset Cron
- Install `@nestjs/schedule`
- Cron job: `0 0 * * *` (midnight) with timezone `Africa/Lagos`
- Reset `dailyUsedKobo` to 0 for all users in `transaction_limits` table
- Update `lastResetAt` to current timestamp

## Phase 15 — Testing & Cleanup
- Unit tests: rate spread calculation, PIN lockout logic, idempotency check, wallet deduction with insufficient balance
- Integration tests: full deposit flow and swap flow via supertest
- Add Swagger documentation (`@nestjs/swagger`)
- Add request logging middleware (NestJS Logger)
- Clean up console.logs
- Write thorough README with setup instructions, env vars, API reference
