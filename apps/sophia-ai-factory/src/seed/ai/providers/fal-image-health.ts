/**
 * @module seed/ai/providers/fal-image-health
 *
 * Health check and certification registration helper for fal.ai image provider.
 * Layer rule: seed only.
 */

import type { HealthStatus, ProviderCapabilities } from '../image-generation-provider';
import { classifyError } from '@/seed/types/failure-kind';
import { registerCertification, ProviderCertificationState } from '@/seed/ai/provider-certification';
import { FAL_PROVIDER_ID } from './fal-image-schemas';

export function registerFalProviderCertification(): void {
  registerCertification(FAL_PROVIDER_ID, {
    state: ProviderCertificationState.PRODUCTION_CANDIDATE,
    security: 'PASS',
    health: 'PASS',
    canary: 'PASS',
    reason: 'R2 + billing wired, smoke verified',
  });
}

export function getFalProviderCapabilities(): ProviderCapabilities {
  return { supportsAspectRatio: true, supportsStyle: false, maxConcurrency: 5 };
}

export async function checkFalEndpointHealth(baseUrl: string): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const res = await fetch(baseUrl, { method: 'GET', signal: AbortSignal.timeout(5_000) });
    const latencyMs = Date.now() - start;
    if (res.ok || res.status === 404) return { healthy: true, latencyMs };
    return { healthy: false, latencyMs, error: `HTTP ${res.status}` };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { healthy: false, latencyMs, error: classifyError(err) };
  }
}
