import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

/**
 * Checks circuit breaker eligibility for Telegram requests.
 */
export function canDispatchTelegram(): boolean {
  return shouldAllowRequest('telegram');
}

/**
 * Records successful Telegram API invocation.
 */
export function recordTelegramSuccess(): void {
  recordSuccess('telegram');
}

/**
 * Records failed Telegram API invocation with error classification.
 */
export function recordTelegramFailure(err: unknown): void {
  recordFailure('telegram', classifyError(err));
}
