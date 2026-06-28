/**
 * Usage Metering Context
 *
 * Async local storage for propagating usage context across async boundaries
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface UsageContext {
  userId: string;
  licenseKeyHash: string;
  licenseNonce: string;
  tier: string;
}

export const usageContextStorage = new AsyncLocalStorage<UsageContext>();

/**
 * Run function with usage context
 */
export function runWithUsageContext<T>(context: UsageContext, fn: () => T): T {
  return usageContextStorage.run(context, fn);
}

/**
 * Get current usage context from async local storage
 */
export function getUsageContext(): UsageContext | null {
  return usageContextStorage.getStore() ?? null;
}
