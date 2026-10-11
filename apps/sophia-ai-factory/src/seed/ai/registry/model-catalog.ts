/**
 * @module seed/ai/registry/model-catalog
 * Mutex operations and request cost calculation helpers.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ChatMessage, ChatOptions } from '../provider-interface';
import { estimateCost } from '../cost-estimator';
import type { RegistryMutex, RegistryEntry } from './types';

/**
 * Creates an in-memory spinlock mutex for Cloudflare Workers edge runtime.
 */
export function createRegistryMutex(): RegistryMutex {
  return { locked: false, waiters: [] };
}

/**
 * Acquires the registry spinlock.
 */
export function acquireMutex(mutex: RegistryMutex): void {
  while (mutex.locked) {
    (globalThis as unknown as { queueMicrotask?: (cb: () => void) => void }).queueMicrotask?.(() => {});
  }
  mutex.locked = true;
}

/**
 * Releases the registry spinlock.
 */
export function releaseMutex(mutex: RegistryMutex): void {
  mutex.locked = false;
}

/**
 * Estimates cost for a request through a provider entry.
 */
export function estimateEntryCost(
  entry: RegistryEntry | undefined,
  messages: ChatMessage[],
  options: ChatOptions,
): number {
  if (!entry) return 0;
  return estimateCost(messages, options.model, options);
}
