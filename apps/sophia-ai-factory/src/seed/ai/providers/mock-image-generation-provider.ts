/**
 * @module seed/ai/providers/mock-image-generation-provider
 *
 * Deterministic mock image generation provider for Creative Cell V1.
 *
 * Three modes via MOCK_IMAGE_PROVIDER_MODE env var:
 *   SUCCESS (default) → deterministic fixture, no randomness
 *   FAILURE          → classified ImageGenerationError, sub-mode via MOCK_IMAGE_FAILURE_KIND
 *   TIMEOUT          → delays past input.timeoutMs, then throws TIMEOUT
 *
 * No external credentials, no network calls, no Math.random.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type {
  ImageGenerationProvider,
  ImageGenerationInput,
  ImageGenerationResult,
  ProviderCapabilities,
  HealthStatus,
} from '../image-generation-provider';
import { ImageGenerationError, isImageGenerationError } from '../image-generation-provider';
import { logger } from '@/seed/utils/logger-utility';

const PROVIDER_ID = 'mock-image-generation';
const PROVIDER_LABEL = 'Mock Image Generation Provider';
const DEFAULT_TIMEOUT_MS = 120_000;
const FIXTURE_LATENCY_MS = 42;

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

const FAILURE_RETRYABLE: Record<MockFailureKind, boolean> = {
  PROVIDER_ERROR: false, RATE_LIMIT: true, AUTH_FAILURE: false,
  NETWORK: true, SERVER_ERROR: true, TIMEOUT: true,
};

const FAILURE_MESSAGES: Record<MockFailureKind, string> = {
  PROVIDER_ERROR: 'Mock provider returned a provider error',
  RATE_LIMIT: 'Mock provider rate limit exceeded',
  AUTH_FAILURE: 'Mock provider authentication failure',
  NETWORK: 'Mock provider network failure',
  SERVER_ERROR: 'Mock provider internal server error',
  TIMEOUT: 'Mock provider request timed out',
};

function resolveMode(explicitMode?: MockProviderMode): MockProviderMode {
  if (explicitMode) return explicitMode;
  const raw = process.env.MOCK_IMAGE_PROVIDER_MODE;
  if (raw === 'FAILURE' || raw === 'TIMEOUT') return raw;
  return 'SUCCESS';
}

function resolveFailureKind(): MockFailureKind {
  const raw = process.env.MOCK_IMAGE_FAILURE_KIND;
  if (raw && (VALID_FAILURE_KINDS as readonly string[]).includes(raw)) {
    return raw as MockFailureKind;
  }
  return 'PROVIDER_ERROR';
}

/** Deterministic FNV-1a hash — same input always yields same output. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicUuid(seed: number): string {
  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
  return `${hex(seed)}-${hex(seed ^ 0x5d588b65).slice(4)}-${hex(seed ^ 0x1b873593).slice(4)}-${hex(seed ^ 0xa7bd1941).slice(4)}-${hex(seed ^ 0x91e10da5)}${hex(seed ^ 0x27d4eb2f).slice(4)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface MockImageGenerationProviderConfig {
  mode?: MockProviderMode;
}

export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly id = PROVIDER_ID;
  readonly label = PROVIDER_LABEL;

  private readonly mode: MockProviderMode;

  constructor(config: MockImageGenerationProviderConfig = {}) {
    this.mode = resolveMode(config.mode);
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const promptHash = hashString(input.prompt);

    if (this.mode === 'TIMEOUT') {
      const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const delay = Math.max(timeoutMs, 100) + 1000;
      logger.debug('[MockImageGenerationProvider] Simulating timeout', undefined, {
        delay, timeoutMs,
      });
      await sleep(delay);
      throw new ImageGenerationError(
        FAILURE_MESSAGES.TIMEOUT, 'TIMEOUT', PROVIDER_ID, true,
      );
    }

    if (this.mode === 'FAILURE') {
      const kind = resolveFailureKind();
      throw new ImageGenerationError(
        FAILURE_MESSAGES[kind], kind, PROVIDER_ID, FAILURE_RETRYABLE[kind],
      );
    }

    return {
      assetRef: `mock://asset/${deterministicUuid(promptHash)}`,
      provider: PROVIDER_ID,
      costCents: 0,
      latencyMs: FIXTURE_LATENCY_MS,
      metadata: {
        mode: 'success', promptHash,
        aspectRatio: input.aspectRatio ?? '1:1',
        generatedAt: '2026-09-06T00:00:00.000Z',
      },
    };
  }

  capabilities(): ProviderCapabilities {
    return { supportsAspectRatio: true, supportsStyle: true, maxConcurrency: 10 };
  }

  async health(): Promise<HealthStatus> {
    if (this.mode === 'TIMEOUT') return { healthy: false, error: 'timeout' };
    return { healthy: true };
  }
}

export function createMockImageGenerationProvider(
  mode?: MockProviderMode,
): MockImageGenerationProvider {
  return new MockImageGenerationProvider({ mode });
}

export const mockImageGenerationProvider = createMockImageGenerationProvider();

export { isImageGenerationError };
