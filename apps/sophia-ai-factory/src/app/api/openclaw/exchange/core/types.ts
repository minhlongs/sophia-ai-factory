export const DEFAULT_TTL_SECONDS = 86_400; // 24 hours
export const MAX_TTL_USER_SECONDS = 86_400; // 24 hours for regular users
export const MAX_TTL_SERVICE_SECONDS = 7 * 24 * 3600; // 7 days — service accounts only
export const HARD_TTL_CEILING = 7 * 24 * 3600; // absolute max

export const RATE_WINDOW_SECONDS = 3600; // 1 hour
export const RATE_MAX_USER = 10;
export const RATE_MAX_IP = 30;

export interface ExchangeRequestBody {
  ttlSeconds?: number;
  extended?: boolean;
}

export interface ExchangeResponse {
  token: string;
  expiresAt: number;
  userId: string;
  jti: string;
}

export type TtlValidationResult =
  | { success: true; ttlSeconds: number }
  | { success: false; error: string; status: number };
