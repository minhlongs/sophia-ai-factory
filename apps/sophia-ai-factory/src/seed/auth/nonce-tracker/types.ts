export type { NonceCache } from '../jwt-nonce-storage';

export interface NonceCheckResult {
  valid: boolean;
  reason?: 'already-used' | 'expired' | 'invalid';
  error?: string;
}

export interface NonceStatsResult {
  totalActive: number;
  expiredCount: number;
  replayAttemptsDetected: number;
}
