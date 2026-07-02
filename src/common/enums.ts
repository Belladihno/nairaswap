export enum KycTier {
  BASIC = 'basic',
  VERIFIED = 'verified',
}

export enum Currency {
  NGN = 'NGN',
  USDT = 'USDT',
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  SWAP_BUY = 'swap_buy',
  SWAP_SELL = 'swap_sell',
  OFFRAMP = 'offramp',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum LockType {
  BUY = 'buy',
  SELL = 'sell',
}
