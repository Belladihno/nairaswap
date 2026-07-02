**NAIRASWAP**

NGN / USDT On & Off Ramp Platform

Technical Requirements Document (TRD)

Version 1.0

June 2026

Prepared by: Abimbola Omisakin (Bellanzo)

# **Table of Contents**

# **1. Project Overview**

## **1.1 What Is NairaSwap?**

NairaSwap is a simulated cryptocurrency on/off ramp platform that allows Nigerian users to convert Nigerian Naira (NGN) to USDT (a US Dollar stablecoin) and back. The platform mirrors the architecture and logic of real-world fintech products like Yellow Card, Busha, and Patricia — but uses Paystack test mode and simulated payouts so no real money moves.

The goal of this project is to demonstrate deep understanding of financial system architecture, including wallet management, exchange rate engines, webhook verification, race condition prevention, idempotency, transaction PIN security, rate locking, and beneficiary management.

## **1.2 Project Goals**

- Build a realistic on/off ramp backend that could be taken to production with minimal changes

- Demonstrate financial-grade engineering: atomicity, idempotency, locking, webhook security

- Showcase a clean NestJS architecture with separation of concerns across modules

- Use a live exchange rate from CoinGecko, cached in Redis, with spread logic applied

- Handle all edge cases: duplicate webhooks, expired rate quotes, insufficient balance, wrong PIN

## **1.3 Tech Stack**

| **Layer** | **Technology** | **Purpose** |
| --- | --- | --- |
| Framework | NestJS (TypeScript) | Backend API framework |
| Database | PostgreSQL | Persistent data storage |
| ORM | TypeORM | Database interaction and migrations |
| Cache / Locking | Redis (via ioredis) | Rate caching, rate lock TTL, idempotency keys |
| Queue | BullMQ | Async jobs — payout processing, notifications |
| Payments | Paystack (test mode) | NGN deposit initiation and webhook confirmation |
| Exchange Rate | CoinGecko API (free) | Live USDT/NGN price feed |
| Auth | JWT (access + refresh tokens) | User authentication |
| Validation | class-validator + class-transformer | DTO validation |
| Config | @nestjs/config | Environment variable management |
| Testing | Jest | Unit and integration tests |
| HTTP Client | Axios (@nestjs/axios) | Calling CoinGecko and Paystack APIs |

# **2. System Architecture**

## **2.1 High-Level Architecture**

NairaSwap follows a modular monolith architecture built with NestJS. Each major domain is a self-contained module with its own controller, service, and entities. All modules share a single PostgreSQL database and a single Redis instance.

The system has the following layers:

- API Layer: NestJS controllers that accept HTTP requests and return responses

- Service Layer: Business logic lives here — validation, calculations, orchestration

- Repository Layer: TypeORM repositories handle all database reads and writes

- Queue Layer: BullMQ workers process async jobs (payouts, notifications)

- Cache Layer: Redis stores rate quotes with TTL, idempotency keys, and cached exchange rates

- External Layer: CoinGecko for exchange rates, Paystack for payments

## **2.2 Module Breakdown**

| **Module** | **Responsibility** |
| --- | --- |
| AuthModule | User registration, login, JWT issuance, refresh token rotation |
| UsersModule | User profile, transaction PIN setup and verification |
| WalletsModule | NGN and USDT wallet creation, balance queries, balance updates |
| RatesModule | Fetch rate from CoinGecko, apply spread, cache in Redis, lock rates per user |
| DepositsModule | Initiate Paystack payment, store pending transaction, handle webhook confirmation |
| SwapModule | Convert between NGN wallet balance and USDT using locked rate |
| OffRampModule | User sells USDT, system simulates NGN payout to saved bank account |
| BeneficiariesModule | Save, list, and delete user bank accounts |
| TransactionsModule | Query transaction history, single transaction detail, receipt generation |
| PriceHistoryModule | Store rate snapshots periodically, expose chart data endpoints |
| AdminModule | Protected admin endpoints: view users, balances, all transactions, update rate |
| QueueModule | BullMQ setup, payout processor, notification processor |

## **2.3 Request Lifecycle**

Every incoming request follows this path:

- Request hits NestJS controller

- Global validation pipe validates the DTO (class-validator)

- JWT Guard (or Public decorator) checks authentication

- PIN Guard checks transaction PIN for money-movement endpoints

- Controller calls the relevant service method

- Service performs business logic, calls repository, calls Redis where needed

- Response is returned to the client

- For async operations (payouts, notifications), a BullMQ job is enqueued and the response returns immediately

# **3. Database Design**

## **3.1 Design Principles**

- All primary keys are UUID v7 — sortable, unique, safe for distributed systems

- Migrations are used over synchronize:true — never auto-sync in any environment

- Soft deletes (deletedAt) on key tables so records are never permanently lost

- All monetary amounts stored as integers in the smallest unit (kobo for NGN, satoshi-equivalent for USDT) to avoid floating point errors

- createdAt and updatedAt on every table, managed by TypeORM

## **3.2 Tables**

### **users**

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | UUID (PK) | UUID v7 |
| firstName | VARCHAR |  |
| lastName | VARCHAR |  |
| email | VARCHAR UNIQUE | Lowercase, indexed |
| passwordHash | VARCHAR | bcrypt hashed |
| pinHash | VARCHAR NULLABLE | bcrypt hashed 4-digit PIN |
| pinAttempts | INTEGER DEFAULT 0 | Failed PIN attempts counter |
| pinLockedUntil | TIMESTAMP NULLABLE | PIN locked until this time after 3 failures |
| kycTier | ENUM('basic','verified') | Defaults to basic |
| isActive | BOOLEAN DEFAULT true | Account active status |
| createdAt | TIMESTAMP | Auto-managed |
| updatedAt | TIMESTAMP | Auto-managed |

### **refresh_tokens**

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | UUID (PK) | UUID v7 |
| userId | UUID (FK → users) | Indexed |
| tokenHash | VARCHAR | SHA-256 hash of the refresh token |
| expiresAt | TIMESTAMP |  |
| revokedAt | TIMESTAMP NULLABLE | Set when token is rotated or logged out |
| createdAt | TIMESTAMP |  |

### **wallets**

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | UUID (PK) | UUID v7 |
| userId | UUID (FK → users) | Indexed |
| currency | ENUM('NGN','USDT') | One row per currency per user |
| balanceKobo | BIGINT DEFAULT 0 | NGN stored in kobo, USDT stored in micro-units (6 decimal places as integer) |
| createdAt | TIMESTAMP |  |
| updatedAt | TIMESTAMP |  |

| **Why store as integer?** Floating point arithmetic is unsafe for money. 0.1 + 0.2 in JavaScript does not equal 0.3. Storing ₦1,500 as 150000 kobo and performing all arithmetic as integers eliminates this risk entirely. When displaying to the user, divide by 100 (NGN) or 1,000,000 (USDT micro-units). |
| --- |

### **rate_snapshots**

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | UUID (PK) | UUID v7 |
| buyRate | DECIMAL(18,6) | NGN per 1 USDT (buy price — higher) |
| sellRate | DECIMAL(18,6) | NGN per 1 USDT (sell price — lower) |
| midRate | DECIMAL(18,6) | Raw rate from CoinGecko before spread |
| source | VARCHAR DEFAULT 'coingecko' | Source of the rate |
| createdAt | TIMESTAMP | Used for price chart queries |

### **transactions**

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | UUID (PK) | UUID v7. Also used as idempotency key |
| userId | UUID (FK → users) | Indexed |
| type | ENUM | 'deposit', 'swap_buy', 'swap_sell', 'offramp' |
| status | ENUM | 'pending', 'processing', 'completed', 'failed' |
| fromCurrency | VARCHAR | NGN or USDT |
| toCurrency | VARCHAR | NGN or USDT |
| fromAmountKobo | BIGINT | Amount deducted in smallest unit |
| toAmountKobo | BIGINT | Amount credited in smallest unit |
| rateUsed | DECIMAL(18,6) | Locked rate at time of transaction |
| paystackReference | VARCHAR NULLABLE | Paystack payment reference |
| paystackStatus | VARCHAR NULLABLE | Raw status from Paystack webhook |
| beneficiaryId | UUID NULLABLE (FK → beneficiaries) | For off-ramp transactions |
| failureReason | TEXT NULLABLE | Why the transaction failed |
| completedAt | TIMESTAMP NULLABLE |  |
| createdAt | TIMESTAMP |  |
| updatedAt | TIMESTAMP |  |

### **rate_locks**

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | UUID (PK) | UUID v7 |
| userId | UUID (FK → users) | One active lock per user at a time |
| lockedRate | DECIMAL(18,6) | The rate locked in for this user |
| lockType | ENUM('buy','sell') | Whether this is a buy or sell quote |
| expiresAt | TIMESTAMP | 5 minutes from creation |
| usedAt | TIMESTAMP NULLABLE | Set when transaction uses this lock |
| createdAt | TIMESTAMP |  |

### **beneficiaries**

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | UUID (PK) | UUID v7 |
| userId | UUID (FK → users) | Indexed |
| bankName | VARCHAR | e.g. GTBank, First Bank |
| bankCode | VARCHAR | Bank code for Paystack transfer |
| accountNumber | VARCHAR | 10-digit NUBAN |
| accountName | VARCHAR | Resolved account name |
| isDefault | BOOLEAN DEFAULT false | User's default payout account |
| deletedAt | TIMESTAMP NULLABLE | Soft delete |
| createdAt | TIMESTAMP |  |

### **idempotency_keys**

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | UUID (PK) | UUID v7 |
| key | VARCHAR UNIQUE | The idempotency key (usually transaction ID or Paystack reference) |
| responseSnapshot | JSONB | The response returned for the original request |
| createdAt | TIMESTAMP |  |
| expiresAt | TIMESTAMP | Cleaned up after 24 hours |

### **transaction_limits**

| **Column** | **Type** | **Notes** |
| --- | --- | --- |
| id | UUID (PK) | UUID v7 |
| userId | UUID (FK → users) | One row per user |
| dailyUsedKobo | BIGINT DEFAULT 0 | Sum of all completed transactions today |
| lastResetAt | TIMESTAMP | Date of last midnight reset |
| createdAt | TIMESTAMP |  |
| updatedAt | TIMESTAMP |  |

# **4. UI Flows (Plain English)**

This section describes every screen a user encounters and exactly what happens on each one. There are no codes here — just the complete user journey from signup to completed transaction.

## **4.1 Authentication Flows**

### **Sign Up Screen**

- User sees fields: First Name, Last Name, Email, Password, Confirm Password

- User fills in details and clicks Sign Up

- System checks: is the email already registered? If yes, return error

- System hashes the password and stores the user

- System automatically creates two wallets for the user: one NGN wallet and one USDT wallet, both starting at zero balance

- System issues an access token and a refresh token

- User is redirected to the Dashboard

### **Login Screen**

- User enters email and password and clicks Login

- System verifies the password against the stored hash

- If wrong password: return error. Account is not locked on password failure

- If correct: system issues a new access token and refresh token

- User is redirected to the Dashboard

### **Set Transaction PIN Screen**

- On first login, if the user has no PIN set, they are prompted to create one

- User enters a 4-digit PIN twice (PIN + Confirm PIN)

- System hashes the PIN with bcrypt and stores it

- User is now able to perform money-movement actions

## **4.2 Dashboard**

- First thing the user sees after logging in

- Shows: USDT balance (large display), current value of USDT in NGN at today's rate

- Example: 'You hold 10 USDT — worth ₦16,200 at today's rate'

- Shows NGN wallet balance below

- Two primary action buttons: Buy USDT and Sell USDT

- Recent Transactions section below — last 5 transactions with type, amount, and status

- Navigation to: Transactions, Beneficiaries, Profile

## **4.3 Deposit NGN Flow**

Before a user can buy USDT, they need NGN in their in-app wallet. This is done via Paystack.

### **Step 1 — Enter Deposit Amount**

- User taps Deposit NGN

- User enters the amount they want to deposit (e.g. ₦20,000)

- Minimum deposit: ₦1,000. Maximum: ₦500,000 per transaction

- User clicks Proceed

### **Step 2 — Paystack Payment**

- Paystack popup opens (or redirect to Paystack payment page)

- User pays with test card: 4084 0840 8408 4081, CVV 408, any future expiry, OTP 123456

- Payment is processed

### **Step 3 — Webhook Confirmation**

- Paystack sends a webhook to the NairaSwap backend

- Backend verifies the webhook signature (HMAC-SHA512)

- Backend checks if this Paystack reference has already been processed (idempotency check)

- If all checks pass: NGN wallet is credited with the deposited amount

- A completed deposit transaction is recorded

- User is redirected to Dashboard and sees updated NGN balance

## **4.4 Buy USDT Flow (On-Ramp via In-App NGN Wallet)**

### **Step 1 — Enter Amount**

- User taps Buy USDT

- User types how much NGN they want to spend OR how much USDT they want to receive

- System fetches the current buy rate from Redis cache

- System shows a live quote: 'Spend ₦16,200 → Receive 10 USDT at rate ₦1,620/USDT'

- Rate is valid for 5 minutes — a countdown timer is displayed

- User clicks Confirm

### **Step 2 — PIN Verification**

- A PIN entry screen appears

- User enters their 4-digit transaction PIN

- If wrong PIN: decrement attempts. After 3 wrong attempts, lock PIN for 15 minutes

- If correct: proceed

### **Step 3 — Processing**

- System checks: is the rate lock still valid (not expired)?

- System checks: does the user have enough NGN balance?

- System checks: does this transaction exceed daily limits?

- If all checks pass: deduct NGN from NGN wallet and credit USDT to USDT wallet atomically

- Transaction is recorded as completed

- User is shown a success screen: '10 USDT added to your wallet'

- User is redirected to Dashboard with updated balances

## **4.5 Sell USDT Flow (Off-Ramp)**

### **Step 1 — Enter Amount**

- User taps Sell USDT

- User types how much USDT they want to sell

- System shows quote: 'Sell 10 USDT → Receive ₦15,800 at sell rate ₦1,580/USDT'

- Note: sell rate is lower than buy rate — this is the platform's spread

- Rate is locked for 5 minutes

- User clicks Confirm

### **Step 2 — Select Bank Account**

- User selects a saved beneficiary account or enters a new bank account

- System displays: 'Send ₦15,800 to GTBank — 0123456789 — John Doe'

- User confirms

### **Step 3 — PIN Verification**

- User enters their 4-digit transaction PIN

### **Step 4 — Processing**

- System checks: does the user have enough USDT?

- System immediately debits USDT from wallet (pessimistic lock)

- Transaction status set to 'processing'

- A BullMQ payout job is queued

- Worker processes the job, simulates bank transfer delay (3-5 seconds), marks as completed

- Transaction status updates to 'completed'

- User is shown: 'Payout of ₦15,800 sent to GTBank — 0123456789'

## **4.6 Transaction History Screen**

- Full list of all user transactions, newest first

- Each row shows: type (Deposit / Buy USDT / Sell USDT), amount, status, date

- Status badges: Pending (yellow), Processing (blue), Completed (green), Failed (red)

- User can tap any transaction to see full details

## **4.7 Transaction Detail / Receipt Screen**

- Shows: Transaction ID, Type, Status, From amount, To amount, Rate used, Date and time, Beneficiary (if off-ramp)

- A 'Download Receipt' button is available for completed transactions

- Receipt is a simple JSON or text response with all the above fields

## **4.8 Price Chart Screen**

- Shows USDT/NGN rate movement over time

- Toggle between: Last 24 hours, Last 7 days, Last 30 days

- Chart is built from stored rate snapshots in the database

- Below chart: current buy rate and sell rate displayed clearly

## **4.9 Beneficiaries Screen**

- List of all saved bank accounts

- Each entry shows: Bank name, Account number (partially masked), Account name

- Add New Account button — user enters bank name, bank code, account number

- System shows account name for confirmation before saving

- User can set any account as default

- User can delete an account (soft delete)

## **4.10 Profile / Settings Screen**

- View name and email

- Change password

- Change transaction PIN

- Log out (revokes refresh token)

# **5. Exchange Rate Engine**

## **5.1 How the Rate Works**

NairaSwap fetches the live USDT/NGN rate from CoinGecko's free public API every 3 minutes. The raw rate is the mid-market rate. NairaSwap applies a spread on top to create a buy rate (higher) and a sell rate (lower). This spread is how the platform earns its margin.

## **5.2 Spread Logic**

| **Rate Type** | **Formula** | **Example (mid = ₦1,600)** |
| --- | --- | --- |
| Mid Rate | Raw CoinGecko rate | ₦1,600 |
| Buy Rate | Mid Rate × 1.0125 (1.25% above mid) | ₦1,620 |
| Sell Rate | Mid Rate × 0.9875 (1.25% below mid) | ₦1,580 |

The spread percentage is stored as a config variable so it can be changed without code changes.

## **5.3 Redis Caching**

- After fetching from CoinGecko, the buy rate, sell rate, and mid rate are stored in Redis with a TTL of 3 minutes

- Every rate request first checks Redis. If a cached rate exists and is not expired, return it immediately

- If Redis has no cached rate (TTL expired or first boot), fetch from CoinGecko, apply spread, store in Redis, and return

- Also save the snapshot to the rate_snapshots table for price chart history

- If CoinGecko is unreachable, fall back to the last stored snapshot in the database and log a warning

## **5.4 Rate Locking**

When a user requests a quote (either to buy or sell USDT), the system locks the current rate for them for 5 minutes. This protects the user from rate changes between the time they see the quote and the time they confirm the transaction.

- System fetches current buy or sell rate from Redis

- System creates a rate_lock record in the database with: userId, lockedRate, lockType (buy/sell), expiresAt (now + 5 minutes)

- Rate lock ID is returned to the client

- When user confirms the transaction, they send the rate lock ID

- System checks: does this rate lock exist? Is it not expired? Is it not already used? Does the lock belong to this user?

- If all checks pass: use lockedRate for the transaction and mark the lock as used

- If the lock is expired: return error 'Quote expired. Please request a new quote'

- One active lock per user at a time — creating a new lock invalidates any previous unused lock

# **6. Transaction Limits**

## **6.1 Per-Transaction Limits**

| **Action** | **Minimum** | **Maximum** |
| --- | --- | --- |
| Deposit NGN | ₦1,000 | ₦500,000 |
| Buy USDT | ₦1,000 equivalent | ₦500,000 equivalent |
| Sell USDT | 1 USDT | 500 USDT |
| Off-Ramp Payout | ₦1,000 | ₦500,000 |

## **6.2 Daily Limits**

| **KYC Tier** | **Daily Transaction Limit** |
| --- | --- |
| Basic (default) | ₦50,000 per day |
| Verified | ₦500,000 per day |

## **6.3 How Daily Limits Are Tracked**

- Each user has one row in the transaction_limits table

- On every completed transaction, dailyUsedKobo is incremented by the transaction amount

- A cron job runs at midnight (00:00 WAT) and resets dailyUsedKobo to 0 for all users and updates lastResetAt

- Before any transaction is processed, the service checks: current dailyUsedKobo + new transaction amount <= daily limit for the user's KYC tier

- If the limit would be exceeded, the transaction is rejected with a clear error message showing how much of the daily limit remains

# **7. Paystack Integration**

## **7.1 Test Mode Setup**

- All Paystack calls use the test secret key from the Paystack dashboard

- No real money moves — Paystack test mode provides fake card numbers and simulates webhooks

- Test card: 4084 0840 8408 4081 / CVV: 408 / Expiry: any future date / OTP: 123456

- Webhooks from Paystack test mode behave identically to production

## **7.2 Deposit Flow (Payment Initiation)**

- User submits deposit amount to POST /deposits/initiate

- Service generates a unique Paystack reference (UUID v7)

- Service creates a pending transaction record in the database with this reference

- Service calls Paystack API: Initialize Transaction, passing amount (in kobo), email, reference, callback URL

- Paystack returns an authorization URL

- Backend returns the authorization URL to the frontend

- Frontend opens Paystack popup / redirects user to that URL

- User completes payment on Paystack

- Paystack sends a webhook to POST /deposits/webhook

## **7.3 Webhook Verification**

This is the most critical security step. When Paystack sends a webhook, your backend must verify that the request genuinely came from Paystack and was not forged by a third party.

- Paystack signs every webhook payload with HMAC-SHA512 using your Paystack secret key

- The signature is sent in the request header as: x-paystack-signature

- Your backend independently computes HMAC-SHA512 of the raw request body using your secret key

- If your computed hash matches the header value: the webhook is genuine

- If they do not match: reject the request immediately with 401. Do not process anything

- CRITICAL: Compute the HMAC on the raw request body (Buffer), not the parsed JSON. Parsing first can alter whitespace and break the signature

- Use NestJS's RawBodyMiddleware to preserve the raw body for webhook routes

## **7.4 Webhook Idempotency**

Paystack can send the same webhook more than once (network retries, temporary errors). Your backend must handle this safely and not credit the user twice.

- After verifying the signature, check if the Paystack reference exists in the idempotency_keys table

- If it exists: this webhook was already processed. Return 200 immediately (to stop Paystack retrying) but do nothing else

- If it does not exist: process the webhook, then insert the reference into idempotency_keys with the response snapshot

- The entire webhook processing (idempotency check + wallet credit + transaction update) runs inside a database transaction so it either all succeeds or all fails

## **7.5 Webhook Processing Logic**

- Verify HMAC signature

- Parse webhook event type — only process 'charge.success' events, ignore others

- Extract Paystack reference from payload

- Check idempotency_keys table — if already processed, return 200 and stop

- Find the pending transaction matching this reference

- If no matching transaction found: log warning and return 200 (could be a payment from another source)

- Begin database transaction

- Credit user's NGN wallet by the confirmed amount

- Update transaction status from 'pending' to 'completed'

- Insert Paystack reference into idempotency_keys

- Commit database transaction

- Return 200 to Paystack

# **8. Wallet Operations ****&**** Race Conditions**

## **8.1 What Is a Race Condition Here?**

A race condition happens when two operations run at the same time and both read the same data before either writes. For example: a user has 10 USDT and clicks Sell twice at exactly the same moment. Both requests read the balance as 10 USDT and both try to deduct 10 USDT — the user ends up with -10 USDT, which is a serious financial bug.

## **8.2 Pessimistic Locking**

NairaSwap uses PostgreSQL's SELECT ... FOR UPDATE to lock a wallet row during any balance-changing operation. Here is how it works:

- When a balance deduction is needed, the service starts a database transaction and selects the wallet row with FOR UPDATE

- PostgreSQL locks that row — any other query trying to SELECT ... FOR UPDATE on the same row will wait

- The service reads the current balance from the locked row

- Checks: is the balance enough? If no, rollback and return insufficient funds error

- If yes: deduct balance and write the new value

- Commit the database transaction

- The lock is released and any waiting queries can now proceed — but they will see the updated balance

- This guarantees that two concurrent deductions can never both succeed against the same balance

## **8.3 Atomic Swap Logic**

When a user buys USDT (swap from NGN wallet to USDT wallet), both balance changes must happen together. If the NGN deduction succeeds but the USDT credit fails, the user loses money. TypeORM's QueryRunner is used to wrap both operations in a single database transaction:

- Begin transaction

- Lock NGN wallet row with SELECT ... FOR UPDATE

- Check NGN balance is sufficient

- Deduct NGN from NGN wallet

- Lock USDT wallet row with SELECT ... FOR UPDATE

- Credit USDT to USDT wallet

- Create transaction record

- Update daily limit tracker

- Mark rate lock as used

- Commit — all 9 steps either fully succeed or fully rollback

## **8.4 Off-Ramp Deduction Before Payout**

For off-ramp (selling USDT), the USDT is deducted from the wallet immediately and synchronously before the payout job is queued. This prevents the user from spending the same USDT while the payout is being processed.

- USDT wallet is locked and debited in the same database transaction that creates the transaction record

- Only after the debit is committed does the payout job get added to the BullMQ queue

- If the payout job fails (simulated failure), the transaction status is set to 'failed' and a refund job is queued to return the USDT

# **9. Transaction PIN**

## **9.1 What the PIN Is For**

The transaction PIN is a second layer of security beyond the login password. It is required for every money-movement action: deposits, swaps, and off-ramp. Even if someone steals a user's access token, they cannot move money without the PIN.

## **9.2 PIN Setup**

- User sets a 4-digit numeric PIN after first login

- PIN is hashed with bcrypt before storage — the raw PIN is never stored

- If a user tries to perform a money action without a PIN set, they are redirected to set one first

## **9.3 PIN Verification Flow**

- User submits their PIN along with the transaction request

- Service fetches pinHash from the users table

- bcrypt.compare(submittedPin, pinHash) is called

- If match: clear pinAttempts counter, proceed

- If no match: increment pinAttempts by 1

- If pinAttempts reaches 3: set pinLockedUntil to now + 15 minutes, return error 'PIN locked for 15 minutes'

- If pinLockedUntil is in the future and user tries again: return 'PIN is locked. Try again in X minutes'

- After 15 minutes: pinLockedUntil has passed, pinAttempts resets to 0 on next successful attempt

## **9.4 PIN Guard**

A custom NestJS guard (PinGuard) is applied to all money-movement endpoints. The guard:

- Reads the x-transaction-pin header from the request

- Calls UsersService.verifyPin(userId, pin)

- If verification fails, throws ForbiddenException before the controller method is even called

- If verification passes, the request proceeds to the controller

# **10. Queue System (BullMQ)**

## **10.1 Why a Queue?**

Some operations should not block the HTTP response. When a user sells USDT, the simulated bank payout takes a few seconds. Instead of making the user wait, the API responds immediately with 'processing' and the payout happens in the background via BullMQ.

## **10.2 Queues**

| **Queue Name** | **Jobs It Handles** |
| --- | --- |
| payout-queue | Process off-ramp NGN payout simulation |
| notification-queue | Send email or in-app notifications on transaction events |
| refund-queue | Refund USDT to user if a payout job fails |
| limit-reset-queue | Daily midnight job to reset all users' dailyUsedKobo to zero |

## **10.3 Payout Processor Logic**

- Job is picked up from the payout-queue

- Fetch the transaction from the database by transactionId

- Check transaction is still in 'processing' status (guard against duplicate job execution)

- Simulate bank transfer: wait 3-5 seconds (setTimeout in simulation)

- Mark transaction status as 'completed', set completedAt to now

- Enqueue a notification job: 'Your payout of ₦X,XXX is complete'

- If any step fails: mark transaction as 'failed', set failureReason, enqueue refund job

## **10.4 Refund Processor Logic**

- Job picked up from refund-queue

- Fetch the failed transaction

- Lock user's USDT wallet with SELECT ... FOR UPDATE

- Credit back the USDT that was deducted

- Create a new refund transaction record linked to the original

- Enqueue notification: 'Your USDT has been refunded due to a payout failure'

## **10.5 Job Configuration**

- All jobs have a retry policy: 3 attempts with exponential backoff (1s, 5s, 30s)

- Failed jobs after max retries go into the 'failed' state in BullMQ for manual inspection

- Jobs are not removed on completion — kept for 7 days for audit purposes

# **11. Authentication System**

## **11.1 JWT Strategy**

- Access token: short-lived (15 minutes), signed with HS256 using ACCESS_TOKEN_SECRET

- Refresh token: long-lived (7 days), signed with HS256 using REFRESH_TOKEN_SECRET

- Access token is sent in the Authorization header: Bearer <token>

- Refresh token is stored in an HTTP-only cookie

## **11.2 Refresh Token Rotation**

- When a refresh token is used to get a new access token, a new refresh token is also issued

- The old refresh token is revoked (revokedAt set in refresh_tokens table)

- If a revoked refresh token is used: this signals token theft — all refresh tokens for the user are revoked and they are forced to log in again

## **11.3 Guards**

| **Guard** | **Purpose** |
| --- | --- |
| JwtAuthGuard | Applied globally. Verifies access token on every request |
| Public decorator | @Public() on endpoints that don't need auth (login, signup, webhook) |
| PinGuard | Applied to all money-movement endpoints. Verifies transaction PIN |
| AdminGuard | Applied to admin endpoints. Checks user has admin role |

# **12. Price Chart ****&**** Portfolio**

## **12.1 Rate Snapshots**

- Every time the rate is fetched from CoinGecko and cached in Redis, a row is also inserted into rate_snapshots

- This happens every 3 minutes automatically

- rate_snapshots stores: buyRate, sellRate, midRate, createdAt

## **12.2 Chart Data Endpoint**

- GET /rates/chart?period=24h returns an array of {rate, timestamp} pairs

- Supported periods: 24h (every 15 minutes), 7d (hourly averages), 30d (daily averages)

- For 24h: SELECT all snapshots in last 24 hours

- For 7d: GROUP BY hour, take average midRate per hour

- For 30d: GROUP BY date, take average midRate per day

- Frontend plots this data as a line chart

## **12.3 Portfolio Value**

- GET /wallets/portfolio returns: USDT balance, current buy rate, current value in NGN, NGN balance, total portfolio value in NGN

- Computed in real-time: usdtBalance × currentBuyRate = NGN value of USDT holdings

- This is what shows on the dashboard: 'You hold 10 USDT — worth ₦16,200 today'

# **13. Beneficiaries (Saved Bank Accounts)**

## **13.1 What It Does**

Beneficiaries are saved bank accounts the user can send NGN payouts to during off-ramp. Instead of typing bank details every time, the user saves them once and selects on future transactions.

## **13.2 Operations**

| **Endpoint** | **What It Does** |
| --- | --- |
| POST /beneficiaries | Save a new bank account. Validates bank name, bank code, account number |
| GET /beneficiaries | List all saved accounts for the logged-in user (excludes soft deleted) |
| PATCH /beneficiaries/:id/default | Set one account as the user's default payout account |
| DELETE /beneficiaries/:id | Soft delete — sets deletedAt, not physically removed |

## **13.3 Validation Rules**

- Account number must be exactly 10 digits (NUBAN format)

- Bank code must be a valid Nigerian bank code (validated against a hardcoded list)

- A user can have a maximum of 5 saved beneficiaries

- Duplicate account numbers for the same user are rejected

# **14. API Endpoints Reference**

## **14.1 Auth**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| POST | /auth/register | No | Register new user |
| POST | /auth/login | No | Login, receive tokens |
| POST | /auth/refresh | No (uses cookie) | Rotate refresh token |
| POST | /auth/logout | Yes | Revoke refresh token |

## **14.2 Users**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| GET | /users/me | Yes | Get current user profile |
| POST | /users/pin/setup | Yes | Set transaction PIN for first time |
| PATCH | /users/pin/change | Yes + PIN | Change existing transaction PIN |
| PATCH | /users/password | Yes | Change login password |

## **14.3 Wallets**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| GET | /wallets | Yes | Get both wallet balances |
| GET | /wallets/portfolio | Yes | Get balances + USDT value in NGN |

## **14.4 Rates**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| GET | /rates/current | Yes | Get current buy and sell rates |
| POST | /rates/lock | Yes | Lock rate for 5 minutes, returns lockId |
| GET | /rates/chart | Yes | Get rate history for chart (query: period=24h/7d/30d) |

## **14.5 Deposits**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| POST | /deposits/initiate | Yes + PIN | Start Paystack payment, returns auth URL |
| POST | /deposits/webhook | No (Paystack) | Paystack webhook receiver — HMAC verified |

## **14.6 Swaps (Buy USDT)**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| POST | /swaps/buy | Yes + PIN | Convert NGN wallet balance to USDT using locked rate |

## **14.7 Off-Ramp (Sell USDT)**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| POST | /offramp/initiate | Yes + PIN | Sell USDT, queue payout job |

## **14.8 Beneficiaries**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| GET | /beneficiaries | Yes | List saved bank accounts |
| POST | /beneficiaries | Yes | Add new bank account |
| PATCH | /beneficiaries/:id/default | Yes | Set as default |
| DELETE | /beneficiaries/:id | Yes | Soft delete account |

## **14.9 Transactions**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| GET | /transactions | Yes | List all transactions (paginated) |
| GET | /transactions/:id | Yes | Single transaction detail |
| GET | /transactions/:id/receipt | Yes | Download transaction receipt |

## **14.10 Admin**

| **Method** | **Endpoint** | **Auth Required** | **Description** |
| --- | --- | --- | --- |
| GET | /admin/users | Yes + Admin | List all users with balances |
| GET | /admin/transactions | Yes + Admin | All platform transactions |
| PATCH | /admin/rates/override | Yes + Admin | Manually override exchange rate |
| PATCH | /admin/users/:id/kyc | Yes + Admin | Upgrade user KYC tier |

# **15. Step-by-Step Build Order**

Build in this exact order. Each phase depends on the one before it.

## **Phase 1 — Project Setup**

- Scaffold NestJS project: nest new nairaswap

- Install all packages (see Section 16)

- Set up .env file with all environment variables

- Configure @nestjs/config globally

- Set up PostgreSQL connection via TypeORM in app.module.ts

- Set up Redis connection via ioredis

- Set up BullMQ with the Redis connection

- Enable global ValidationPipe in main.ts

- Enable RawBodyMiddleware for the /deposits/webhook route

## **Phase 2 — Database ****&**** Migrations**

- Create all TypeORM entities: User, RefreshToken, Wallet, RateSnapshot, Transaction, RateLock, Beneficiary, IdempotencyKey, TransactionLimit

- Run initial migration to create all tables

- Confirm all tables created correctly in PostgreSQL

## **Phase 3 — Auth Module**

- Build UsersModule: User entity, UsersService (create user, find by email), UsersRepository

- Build AuthModule: register endpoint, login endpoint, JWT strategy, JwtAuthGuard, Public decorator

- Build refresh token rotation logic

- Build logout endpoint (revoke token)

- Test: register a user, login, refresh token, logout

## **Phase 4 — Wallets Module**

- Build WalletsModule: Wallet entity, WalletsService

- On user registration, automatically create NGN and USDT wallets with zero balance

- Build GET /wallets endpoint

- Build the core updateBalance method with SELECT ... FOR UPDATE inside a QueryRunner transaction

- Test: register user, check wallets are created with zero balances

## **Phase 5 — Transaction PIN**

- Add PIN fields to User entity: pinHash, pinAttempts, pinLockedUntil

- Build POST /users/pin/setup endpoint

- Build UsersService.verifyPin method with lockout logic

- Build PinGuard

- Apply PinGuard to a test endpoint and verify it works

## **Phase 6 — Rates Module**

- Build RatesModule

- Implement CoinGecko fetch with Axios

- Implement spread calculation (buyRate, sellRate from midRate)

- Implement Redis caching with 3-minute TTL

- Implement database fallback when CoinGecko is unreachable

- Build GET /rates/current endpoint

- Build rate snapshot save logic

- Build rate lock: POST /rates/lock — creates rate_lock record with 5-min expiry in both DB and Redis

- Test: call /rates/current, verify Redis is populated, verify snapshot saved to DB

## **Phase 7 — Deposits Module**

- Build DepositsModule

- Implement POST /deposits/initiate — call Paystack initialize transaction API, create pending transaction

- Implement POST /deposits/webhook with raw body parsing

- Implement HMAC-SHA512 signature verification

- Implement idempotency check against idempotency_keys table

- Implement wallet credit inside database transaction

- Test with Paystack test card — complete a payment and confirm NGN wallet is credited

## **Phase 8 — Swaps Module**

- Build SwapsModule

- Implement POST /swaps/buy

- Validate rate lock: exists, not expired, not used, belongs to this user

- Check NGN balance is sufficient

- Check daily limit

- Execute atomic swap: lock both wallets, deduct NGN, credit USDT, record transaction, update daily limit, mark rate lock used — all in one QueryRunner transaction

- Test: deposit NGN, lock rate, buy USDT, verify both wallet balances updated correctly

## **Phase 9 — Off-Ramp Module**

- Build OffRampModule

- Implement POST /offramp/initiate

- Validate rate lock (sell type)

- Check USDT balance

- Check daily limit

- Deduct USDT atomically and create transaction in 'processing' status

- Enqueue payout job to BullMQ

- Build PayoutProcessor: simulate delay, mark completed, enqueue notification

- Build RefundProcessor: credit back USDT on failure

- Test: sell USDT, verify USDT is deducted, job runs, transaction completes

## **Phase 10 — Beneficiaries Module**

- Build BeneficiariesModule with all CRUD endpoints

- Add beneficiary selection to off-ramp flow

- Test: add beneficiary, set default, delete, use in off-ramp

## **Phase 11 — Transactions Module**

- Build TransactionsModule

- Implement paginated GET /transactions with filters (type, status, date range)

- Implement GET /transactions/:id

- Implement GET /transactions/:id/receipt — returns structured receipt JSON

## **Phase 12 — Price Chart ****&**** Portfolio**

- Implement GET /rates/chart with period query param and DB aggregation

- Implement GET /wallets/portfolio with real-time NGN value calculation

## **Phase 13 — Admin Module**

- Add isAdmin field to User entity

- Build AdminGuard

- Implement all admin endpoints: list users, all transactions, rate override, KYC upgrade

## **Phase 14 — Daily Limit Reset Cron**

- Install @nestjs/schedule

- Build a cron job that runs at midnight WAT (00:00 Africa/Lagos timezone)

- Job resets dailyUsedKobo to 0 for all users in transaction_limits table

## **Phase 15 — Testing ****&**** Cleanup**

- Write unit tests for: rate spread calculation, PIN lockout logic, idempotency check, wallet deduction with insufficient balance

- Write integration tests for the full deposit flow and swap flow

- Add Swagger documentation (@nestjs/swagger)

- Add request logging middleware

- Clean up all console.logs, add proper NestJS Logger

- Write a thorough README with setup instructions, environment variables, and a full API reference

# **16. Packages ****&**** Dependencies**

## **16.1 Production Dependencies**

| **Package** | **Purpose** |
| --- | --- |
| @nestjs/core, @nestjs/common, @nestjs/platform-express | NestJS core framework |
| @nestjs/config | Environment variable management |
| @nestjs/typeorm, typeorm | ORM and database interaction |
| @nestjs/jwt, @nestjs/passport, passport, passport-jwt | JWT authentication |
| @nestjs/axios, axios | HTTP client for CoinGecko and Paystack API calls |
| @nestjs/schedule | Cron jobs (midnight limit reset) |
| @nestjs/swagger | Auto-generated API documentation |
| @nestjs/bullmq, bullmq | Queue system for async jobs |
| pg | PostgreSQL driver |
| ioredis | Redis client |
| bcrypt | Password and PIN hashing |
| class-validator, class-transformer | DTO validation and transformation |
| uuid | UUID v7 generation |
| crypto (built-in Node.js) | HMAC-SHA512 for webhook verification |
| reflect-metadata | Required by NestJS decorators |
| rxjs | Required by NestJS |

## **16.2 Development Dependencies**

| **Package** | **Purpose** |
| --- | --- |
| @types/node, @types/express, @types/bcrypt | TypeScript type definitions |
| @types/passport-jwt | JWT strategy type definitions |
| typescript | TypeScript compiler |
| ts-node | Run TypeScript directly |
| jest, @types/jest, ts-jest | Testing framework |
| @nestjs/testing | NestJS test utilities |
| supertest, @types/supertest | HTTP integration testing |
| eslint, prettier | Linting and formatting |

# **17. Environment Variables**

| **Variable** | **Description** | **Example** |
| --- | --- | --- |
| DATABASE_URL | PostgreSQL connection string | postgresql://user:pass@localhost:5432/nairaswap |
| REDIS_URL | Redis connection string | redis://localhost:6379 |
| ACCESS_TOKEN_SECRET | JWT access token signing secret | long-random-string |
| REFRESH_TOKEN_SECRET | JWT refresh token signing secret | another-long-random-string |
| ACCESS_TOKEN_EXPIRY | Access token lifetime | 15m |
| REFRESH_TOKEN_EXPIRY | Refresh token lifetime | 7d |
| PAYSTACK_SECRET_KEY | Paystack test secret key | sk_test_xxxxx |
| PAYSTACK_PUBLIC_KEY | Paystack test public key | pk_test_xxxxx |
| PAYSTACK_WEBHOOK_SECRET | Same as secret key for HMAC verification | sk_test_xxxxx |
| COINGECKO_API_URL | CoinGecko base URL | https://api.coingecko.com/api/v3 |
| RATE_CACHE_TTL_SECONDS | How long to cache rate in Redis | 180 |
| RATE_LOCK_TTL_SECONDS | How long a rate lock is valid | 300 |
| RATE_SPREAD_PERCENT | Spread applied to mid rate | 1.25 |
| APP_URL | Base URL of the app (for Paystack callback) | http://localhost:3000 |
| NODE_ENV | Environment | development |
| PORT | Server port | 3000 |

# **18. Error Handling**

## **18.1 Global Exception Filter**

A global exception filter catches all unhandled errors and returns consistent JSON responses. Every error response follows this shape: statusCode, message, error, timestamp, path.

## **18.2 Business Logic Errors**

| **Scenario** | **HTTP Status** | **Message** |
| --- | --- | --- |
| Invalid credentials | 401 | Invalid email or password |
| Access token expired | 401 | Access token expired |
| Wrong transaction PIN | 403 | Incorrect PIN. X attempts remaining |
| PIN locked | 403 | PIN locked. Try again in X minutes |
| Insufficient wallet balance | 422 | Insufficient balance |
| Rate lock expired | 422 | Quote expired. Please request a new quote |
| Rate lock already used | 422 | This quote has already been used |
| Daily limit exceeded | 422 | Daily limit exceeded. Remaining: ₦X,XXX |
| Below minimum amount | 400 | Minimum transaction amount is ₦1,000 |
| Above maximum amount | 400 | Maximum transaction amount is ₦500,000 |
| Duplicate webhook | 200 | (Silent — returns 200, does nothing) |
| Invalid webhook signature | 401 | Invalid webhook signature |
| Beneficiary not found | 404 | Beneficiary not found |
| Max beneficiaries reached | 422 | Maximum of 5 saved accounts allowed |

# **19. Security Considerations**

- Passwords and PINs are never stored in plain text — always bcrypt hashed with cost factor 12

- Webhook endpoint verifies HMAC-SHA512 signature before processing any payload

- All money-movement endpoints require both a valid JWT AND a correct transaction PIN

- Refresh tokens are stored as hashes — the raw token is never stored

- Idempotency keys prevent double-processing of payments and webhooks

- Pessimistic locking prevents race conditions on all wallet balance updates

- Daily limits prevent a single compromised account from draining large amounts

- PIN lockout after 3 failed attempts prevents brute-force PIN guessing

- Rate locks prevent bait-and-switch rate manipulation

- Admin endpoints are protected by a separate AdminGuard and require the isAdmin flag

- All inputs are validated via class-validator DTOs — no raw unvalidated data reaches the service layer

- Database queries use parameterized queries via TypeORM — no raw string interpolation, preventing SQL injection

# **20. Open Questions ****&**** Future Extensions**

## **20.1 Out of Scope for This Version**

- Real KYC with ID document upload and verification

- Real bank transfer via Paystack Transfer API (simulated in this version)

- Email notifications (stubbed — just recorded in database)

- 2FA / OTP on login

- Multiple stablecoin support (USDC, DAI)

- Real blockchain interactions

## **20.2 Potential Extensions**

- Add a Notifications table and expose GET /notifications endpoint so the frontend can poll for updates

- Add WebSocket support (Socket.io) for real-time transaction status updates

- Add email sending via Resend when transactions complete

- Add real Paystack Transfer API calls for actual NGN payouts

- Add support for multiple currencies beyond NGN/USDT

*End of Document*

NairaSwap TRD v1.0 — Prepared by Abimbola Omisakin (Bellanzo) — June 2026