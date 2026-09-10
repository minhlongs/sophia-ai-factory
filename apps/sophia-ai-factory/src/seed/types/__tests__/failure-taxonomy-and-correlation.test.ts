/**
 * Failure Taxonomy & Correlation Context Test Suite.
 *
 * Enforces Phase 11 invariants:
 * 1. Structured Failure Taxonomy:
 *    - All 8 canonical failure categories:
 *      AUTH_FAILURE, OWNERSHIP_FAILURE, BILLING_FAILURE, PROVIDER_AUTH_FAILURE,
 *      PROVIDER_CAPABILITY_FAILURE, MISSION_FAILURE, STORAGE_FAILURE, WEBHOOK_FAILURE.
 *    - Accurate classification of domain and system errors.
 * 2. Unbroken Correlation ID Propagation:
 *    - Strict end-to-end lineage tracing:
 *      request -> mission -> provider -> artifact.
 *    - Preserves correlationId invariant across all async workflow hops.
 *
 * @module seed/types/__tests__/failure-taxonomy-and-correlation.test
 */

import { describe, it, expect } from 'vitest';
import {
  FailureKind,
  classifyError,
  classifyHttpStatus,
  createCorrelationContext,
  propagateCorrelation,
  type CorrelationContext,
} from '../failure-kind';

describe('Phase 11: Structured Failure Taxonomy', () => {
  it('contains all 8 required canonical failure kinds', () => {
    const requiredKinds: FailureKind[] = [
      FailureKind.AUTH_FAILURE,
      FailureKind.OWNERSHIP_FAILURE,
      FailureKind.BILLING_FAILURE,
      FailureKind.PROVIDER_AUTH_FAILURE,
      FailureKind.PROVIDER_CAPABILITY_FAILURE,
      FailureKind.MISSION_FAILURE,
      FailureKind.STORAGE_FAILURE,
      FailureKind.WEBHOOK_FAILURE,
    ];

    for (const kind of requiredKinds) {
      expect(Object.values(FailureKind)).toContain(kind);
    }
  });

  it('classifies HTTP status codes accurately', () => {
    expect(classifyHttpStatus(401)).toBe(FailureKind.AUTH_FAILURE);
    expect(classifyHttpStatus(403)).toBe(FailureKind.AUTH_FAILURE);
    expect(classifyHttpStatus(429)).toBe(FailureKind.RATE_LIMIT);
    expect(classifyHttpStatus(500)).toBe(FailureKind.SERVER_ERROR);
    expect(classifyHttpStatus(502)).toBe(FailureKind.SERVER_ERROR);
    expect(classifyHttpStatus(408)).toBe(FailureKind.TIMEOUT);
    expect(classifyHttpStatus(200)).toBe(FailureKind.UNKNOWN);
  });

  it('classifies caught domain errors into structured failure kinds', () => {
    expect(classifyError(new Error('workspace_access_denied'))).toBe(FailureKind.OWNERSHIP_FAILURE);
    expect(classifyError(new Error('insufficient_entitlement for tier'))).toBe(FailureKind.BILLING_FAILURE);
    expect(classifyError(new Error('missing_provider_credential for replicate'))).toBe(FailureKind.PROVIDER_AUTH_FAILURE);
    expect(classifyError(new Error('capability_not_supported: AI_VIDEO'))).toBe(FailureKind.PROVIDER_CAPABILITY_FAILURE);
    expect(classifyError(new Error('storage_unavailable: R2 disconnected'))).toBe(FailureKind.STORAGE_FAILURE);
    expect(classifyError(new Error('ipn_error: invalid payment signature'))).toBe(FailureKind.WEBHOOK_FAILURE);
    expect(classifyError(new Error('mission_failed during execution'))).toBe(FailureKind.MISSION_FAILURE);
    expect(classifyError(new Error('Rate limit hit 429'))).toBe(FailureKind.RATE_LIMIT);
    expect(classifyError(new Error('Connection timeout AbortError'))).toBe(FailureKind.TIMEOUT);
  });
});

describe('Phase 11: Unbroken Correlation Lineage (Request -> Mission -> Provider -> Artifact)', () => {
  it('creates an initial correlation context with valid ID', () => {
    const context = createCorrelationContext({
      requestId: 'req_init_001',
    });

    expect(context.correlationId.startsWith('corr_')).toBe(true);
    expect(context.requestId).toBe('req_init_001');
    expect(context.timestamp).toBeGreaterThan(0);
  });

  it('propagates the identical correlationId across the full 4-stage lifecycle', () => {
    // Stage 1: Request Arrival
    const stage1Request: CorrelationContext = createCorrelationContext({
      requestId: 'req_http_1001',
    });
    const rootCorrelationId = stage1Request.correlationId;

    // Stage 2: Mission Scheduled
    const stage2Mission: CorrelationContext = propagateCorrelation(stage1Request, {
      missionId: 'msn_render_2002',
    });
    expect(stage2Mission.correlationId).toBe(rootCorrelationId);
    expect(stage2Mission.requestId).toBe('req_http_1001');
    expect(stage2Mission.missionId).toBe('msn_render_2002');

    // Stage 3: AI Provider Dispatch
    const stage3Provider: CorrelationContext = propagateCorrelation(stage2Mission, {
      provider: 'fal-ai',
    });
    expect(stage3Provider.correlationId).toBe(rootCorrelationId);
    expect(stage3Provider.missionId).toBe('msn_render_2002');
    expect(stage3Provider.provider).toBe('fal-ai');

    // Stage 4: Artifact Produced & Persisted
    const stage4Artifact: CorrelationContext = propagateCorrelation(stage3Provider, {
      artifactId: 'art_video_4004',
    });
    expect(stage4Artifact.correlationId).toBe(rootCorrelationId);
    expect(stage4Artifact.requestId).toBe('req_http_1001');
    expect(stage4Artifact.missionId).toBe('msn_render_2002');
    expect(stage4Artifact.provider).toBe('fal-ai');
    expect(stage4Artifact.artifactId).toBe('art_video_4004');

    // Lineage verification: The correlation ID remained invariant across all 4 stages
    expect(stage4Artifact.correlationId).toBe(stage1Request.correlationId);
  });
});
