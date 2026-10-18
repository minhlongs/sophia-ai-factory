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
import {
  type MockProviderMode,
  type MockFailureKind,
  FAILURE_RETRYABLE,
  FAILURE_MESSAGES,
  resolveMode,
  resolveFailureKind,
  hashString,
  deterministicUuid,
  sleep,
} from './mock-image-generation-helpers';

export type { MockProviderMode, MockFailureKind };

const PROVIDER_ID = 'mock-image-generation';
const PROVIDER_LABEL = 'Mock Image Generation Provider';
const DEFAULT_TIMEOUT_MS = 120_000;
const FIXTURE_LATENCY_MS = 42;

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
