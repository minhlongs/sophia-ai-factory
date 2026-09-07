/**
 * Provider certification enforcement unit tests.
 *
 * Validates the 5-state certification system (NOT_CERTIFIED | EXPERIMENTAL |
 * PRODUCTION_CANDIDATE | PRODUCTION_READY | BLOCKED) and the blocking
 * guard that prevents instantiation of uncertified/blocked providers.
 *
 * @module seed/ai/__tests__/provider-certification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProviderCertificationState,
  registerCertification,
  getCertification,
  isCertificationBlocking,
  ProviderNotCertifiedError,
} from '../provider-certification';
import { FailureKind, classifyError } from '@/seed/types/failure-kind';
import type { ProviderId } from '@/seed/ai/provider-interface';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function experimentalCert() {
  return {
    state: ProviderCertificationState.EXPERIMENTAL,
    security: 'PASS' as const,
    health: 'PASS' as const,
    canary: 'NOT_EVALUATED' as const,
    reason: 'Test EXPERIMENTAL provider',
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('provider-certification', () => {
  beforeEach(() => {
    // Note: certificationStates is module-level; tests must not assume isolation
    // beyond what the registry provides. We re-register hermes BLOCKED to keep
    // the test deterministic regardless of import order.
    registerCertification('hermes', {
      state: ProviderCertificationState.BLOCKED,
      security: 'BLOCKED',
      health: 'BLOCKED',
      canary: 'BLOCKED',
      reason: 'Test BLOCKED provider',
    });
  });

  it('1. isCertificationBlocking("hermes") returns true (BLOCKED state)', () => {
    expect(isCertificationBlocking('hermes')).toBe(true);
  });

  it('2. isCertificationBlocking("openrouter") returns false (NOT_CERTIFIED default is blocking, but openrouter is registered PRODUCTION_READY)', () => {
    registerCertification('openrouter', {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
      reason: 'Production-ready provider',
    });
    expect(isCertificationBlocking('openrouter')).toBe(false);
  });

  it('3. getCertification("hermes").state === BLOCKED', () => {
    const cert = getCertification('hermes');
    expect(cert.state).toBe(ProviderCertificationState.BLOCKED);
    expect(cert.security).toBe('BLOCKED');
    expect(cert.health).toBe('BLOCKED');
  });

  it('4. ProviderNotCertifiedError carries providerId, certState, reason', () => {
    const err = new ProviderNotCertifiedError(
      'hermes',
      ProviderCertificationState.BLOCKED,
      'External credential exposure',
    );
    expect(err.providerId).toBe('hermes');
    expect(err.certState).toBe(ProviderCertificationState.BLOCKED);
    expect(err.reason).toBe('External credential exposure');
    expect(err.name).toBe('ProviderNotCertifiedError');
    expect(err instanceof Error).toBe(true);
    expect(err instanceof ProviderNotCertifiedError).toBe(true);
  });

  it('5. ProviderNotCertifiedError thrown by buildProviders() with hermes config', async () => {
    const { buildProviders } = await import('@/forest/ai/provider-factory');
    await expect(
      buildProviders({
        providers: [
          { id: 'hermes' as ProviderId, label: 'Hermes', platformApiKey: 'test-key' },
        ],
      }),
    ).rejects.toThrow(ProviderNotCertifiedError);
  });

  it('6. buildProviders() with openrouter config succeeds (key resolves, not blocked)', async () => {
    registerCertification('openrouter', {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
    });
    const { buildProviders } = await import('@/forest/ai/provider-factory');
    const result = await buildProviders({
      providers: [
        { id: 'openrouter', label: 'OpenRouter', platformApiKey: 'test-key' },
      ],
    });
    expect(result.providers.has('openrouter')).toBe(true);
  });

  it('7. ProviderNotCertifiedError.message contains no secrets', () => {
    const err = new ProviderNotCertifiedError(
      'hermes',
      ProviderCertificationState.BLOCKED,
      'Local-only 127.0.0.1:8100 incompatible with CF Workers',
    );
    const msg = err.message;
    expect(msg).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(msg).not.toMatch(/api[_-]?key/i);
    expect(msg).not.toMatch(/bearer\s+\S+/i);
    expect(msg).toContain('PROVIDER_NOT_CERTIFIED');
    expect(msg).toContain('hermes');
  });

  it('8. PROVIDER_NOT_CERTIFIED FailureKind classified by classifyError()', () => {
    const err = new ProviderNotCertifiedError(
      'hermes',
      ProviderCertificationState.BLOCKED,
    );
    expect(classifyError(err)).toBe(FailureKind.PROVIDER_NOT_CERTIFIED);

    // Also classify via message content
    const generic = new Error('PROVIDER_NOT_CERTIFIED: something blocked');
    expect(classifyError(generic)).toBe(FailureKind.PROVIDER_NOT_CERTIFIED);
  });

  it('9. registerCertification + getCertification round-trip', () => {
    registerCertification('test-roundtrip', {
      state: ProviderCertificationState.PRODUCTION_CANDIDATE,
      security: 'PASS',
      health: 'PASS',
      canary: 'BLOCKED',
      certifiedAt: '2026-09-07T00:00:00Z',
      reason: 'Canary failing',
    });
    const cert = getCertification('test-roundtrip');
    expect(cert.state).toBe(ProviderCertificationState.PRODUCTION_CANDIDATE);
    expect(cert.security).toBe('PASS');
    expect(cert.canary).toBe('BLOCKED');
    expect(cert.certifiedAt).toBe('2026-09-07T00:00:00Z');
  });

  it('10. isCertificationBlocking returns false for EXPERIMENTAL state', () => {
    registerCertification('test-experimental', experimentalCert());
    // EXPERIMENTAL is a graded state — allows instantiation (not a blocking gate).
    expect(isCertificationBlocking('test-experimental')).toBe(false);
  });
});
