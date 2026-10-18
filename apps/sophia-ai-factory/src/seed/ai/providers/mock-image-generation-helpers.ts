/**
 * @module seed/ai/providers/mock-image-generation-helpers
 *
 * Deterministic hashing, mode/failure resolution, and fixtures for MockImageGenerationProvider.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

export type MockProviderMode = 'SUCCESS' | 'FAILURE' | 'TIMEOUT';

export type MockFailureKind =
  | 'PROVIDER_ERROR'
  | 'RATE_LIMIT'
  | 'AUTH_FAILURE'
  | 'NETWORK'
  | 'SERVER_ERROR'
  | 'TIMEOUT';

const VALID_FAILURE_KINDS: readonly MockFailureKind[] = [
  'PROVIDER_ERROR', 'RATE_LIMIT', 'AUTH_FAILURE', 'NETWORK', 'SERVER_ERROR', 'TIMEOUT',
];

export const FAILURE_RETRYABLE: Record<MockFailureKind, boolean> = {
  PROVIDER_ERROR: false, RATE_LIMIT: true, AUTH_FAILURE: false,
  NETWORK: true, SERVER_ERROR: true, TIMEOUT: true,
};

export const FAILURE_MESSAGES: Record<MockFailureKind, string> = {
  PROVIDER_ERROR: 'Mock provider returned a provider error',
  RATE_LIMIT: 'Mock provider rate limit exceeded',
  AUTH_FAILURE: 'Mock provider authentication failure',
  NETWORK: 'Mock provider network failure',
  SERVER_ERROR: 'Mock provider internal server error',
  TIMEOUT: 'Mock provider request timed out',
};

export function resolveMode(explicitMode?: MockProviderMode): MockProviderMode {
  if (explicitMode) return explicitMode;
  const raw = process.env.MOCK_IMAGE_PROVIDER_MODE;
  if (raw === 'FAILURE' || raw === 'TIMEOUT') return raw;
  return 'SUCCESS';
}

export function resolveFailureKind(): MockFailureKind {
  const raw = process.env.MOCK_IMAGE_FAILURE_KIND;
  if (raw && (VALID_FAILURE_KINDS as readonly string[]).includes(raw)) {
    return raw as MockFailureKind;
  }
  return 'PROVIDER_ERROR';
}

/** Deterministic FNV-1a hash — same input always yields same output. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function deterministicUuid(seed: number): string {
  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
  return `${hex(seed)}-${hex(seed ^ 0x5d588b65).slice(4)}-${hex(seed ^ 0x1b873593).slice(4)}-${hex(seed ^ 0xa7bd1941).slice(4)}-${hex(seed ^ 0x91e10da5)}${hex(seed ^ 0x27d4eb2f).slice(4)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
