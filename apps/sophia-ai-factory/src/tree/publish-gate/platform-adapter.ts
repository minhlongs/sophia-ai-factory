/**
 * Compliance Publish Gate — Provider-Neutral Mock Platform Adapter Contract.
 *
 * All adapters are deterministic, zero-network, and strictly `MOCK_ONLY`.
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/platform-adapter
 */

import type {
  MockExecutionReceipt,
  MockFailureInjectionMode,
  PlatformCapabilitySnapshot,
  PublishGatePayload,
  PublishGatePlatform,
} from './types';
import { tiktokMockAdapter } from './adapters/tiktok-mock-adapter';
import { youtubeMockAdapter } from './adapters/youtube-mock-adapter';
import { instagramMockAdapter } from './adapters/instagram-mock-adapter';

export interface PreflightContext {
  readonly payload: PublishGatePayload;
  readonly failureInjection?: MockFailureInjectionMode;
  readonly verifiedDate?: string;
}

export interface PreflightEvaluation {
  readonly passed: boolean;
  readonly snapshot: PlatformCapabilitySnapshot;
  readonly blockReasons: readonly string[];
  readonly warnings: readonly string[];
}

export interface MockExecutionContext {
  readonly requestId: string;
  readonly orgId: string;
  readonly payload: PublishGatePayload;
  readonly payloadDigestSha256: string;
  readonly executionClaimId: string;
  readonly snapshot: PlatformCapabilitySnapshot;
  readonly failureInjection?: MockFailureInjectionMode;
  readonly nowIso: string;
}

export interface PublishGateAdapter {
  readonly platform: PublishGatePlatform;
  readonly mode: 'MOCK_ONLY';
  preflight(ctx: PreflightContext): PreflightEvaluation;
  executeMock(ctx: MockExecutionContext): MockExecutionReceipt;
}

const ADAPTER_REGISTRY: Readonly<Record<PublishGatePlatform, PublishGateAdapter>> = {
  tiktok: tiktokMockAdapter,
  youtube: youtubeMockAdapter,
  instagram: instagramMockAdapter,
};

export function getMockPublishGateAdapter(
  platform: PublishGatePlatform,
): PublishGateAdapter {
  const adapter = ADAPTER_REGISTRY[platform];
  if (adapter.mode !== 'MOCK_ONLY') {
    throw new Error(`Adapter for ${platform} violates MOCK_ONLY invariant`);
  }
  return adapter;
}
