/**
 * Contract tests for the canonical OPC execution state machine.
 * No browser, no provider, no DB — pure boundary logic.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateArtifactGate,
  evaluatePublishGate,
  evaluateRenderGate,
  isTerminalState,
  transitionExecutionState,
  type ExecutionEvidence,
  type VerifiedArtifact,
} from '../execution-contract';

const NOW = 1_700_000_000_000;

const artifact: VerifiedArtifact = {
  id: 'art_1',
  storageKey: 'r2://tenant-a/renders/run_1.mp4',
  mediaType: 'video/mp4',
  byteSize: 2048,
  checksumSha256: 'a'.repeat(64),
  isFixture: true,
  verifiedAtMs: NOW - 1000,
  durationSec: 15,
};

function evidence(overrides: Partial<ExecutionEvidence> = {}): ExecutionEvidence {
  return {
    tenantId: 'ws_a',
    state: 'approval_pending',
    jurisdictionKnown: true,
    termsVerified: true,
    approval: {
      status: 'approved',
      currentHash: 'hash-v1',
      storedHash: 'hash-v1',
      approvedAtMs: NOW - 5000,
      expiresAtMs: NOW + 60_000,
      revokedAtMs: null,
      nowMs: NOW,
    },
    killSwitchActive: false,
    reservedCostCents: 40,
    maxCostCents: 50,
    credentialsConnected: true,
    voiceover: { success: true, provider: 'elevenlabs', isFixture: false },
    artifact: null,
    affiliateTargetUrl: 'https://track.example/r/abc',
    targetAccount: 'channel_yt_1',
    outcomeKnown: true,
    ...overrides,
  };
}

describe('execution state machine', () => {
  it('never treats a manifest / queued render as rendered or published', () => {
    expect(transitionExecutionState('render_queued', 'published').ok).toBe(false);
    expect(transitionExecutionState('approval_pending', 'rendered').ok).toBe(false);
    expect(transitionExecutionState('render_queued', 'rendered').ok).toBe(true);
    expect(isTerminalState('published')).toBe(true);
    expect(isTerminalState('render_queued')).toBe(false);
  });

  it('allows a compliant render to be QUEUED but not marked rendered without verified bytes', () => {
    const render = evaluateRenderGate(evidence());
    expect(render.ok).toBe(true);
    if (render.ok) expect(render.value.nextState).toBe('render_queued');

    const rendered = evaluateArtifactGate(evidence({ state: 'render_queued' }));
    expect(rendered.ok).toBe(false);
    if (!rendered.ok) expect(rendered.error).toBe('MEDIA_NOT_VERIFIED');
  });

  it('fails closed when TTS fails or returns a mock provider', () => {
    const failed = evaluateRenderGate(evidence({ voiceover: { success: false, provider: 'mock', isFixture: false } }));
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error).toBe('PROVIDER_UNAVAILABLE');

    const mockSuccess = evaluateRenderGate(evidence({ voiceover: { success: true, provider: 'mock', isFixture: false } }));
    expect(mockSuccess.ok).toBe(false);
    if (!mockSuccess.ok) expect(mockSuccess.error).toBe('PROVIDER_UNAVAILABLE');
  });

  it('blocks unknown jurisdiction / unverified terms before any spend', () => {
    const unknown = evaluateRenderGate(evidence({ jurisdictionKnown: false }));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toBe('UNVERIFIED_ELIGIBILITY');

    const noTerms = evaluateRenderGate(evidence({ termsVerified: false }));
    expect(noTerms.ok).toBe(false);
    if (!noTerms.ok) expect(noTerms.error).toBe('UNVERIFIED_ELIGIBILITY');
  });

  it('re-verifies approval hash, expiry and revocation at the publish boundary', () => {
    const publishBase = evidence({ state: 'rendered', artifact });
    expect(evaluatePublishGate(publishBase).ok).toBe(true);

    const mutated = evidence({
      state: 'rendered',
      artifact,
      approval: { ...publishBase.approval, currentHash: 'hash-v2' },
    });
    const res = evaluatePublishGate(mutated);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('APPROVAL_INVALIDATED');

    const expired = evidence({
      state: 'rendered',
      artifact,
      approval: { ...publishBase.approval, expiresAtMs: NOW - 1 },
    });
    expect(evaluatePublishGate(expired).ok).toBe(false);

    const revoked = evidence({
      state: 'rendered',
      artifact,
      approval: { ...publishBase.approval, revokedAtMs: NOW - 1 },
    });
    expect(evaluatePublishGate(revoked).ok).toBe(false);
  });

  it('re-checks halt, budget, credentials and uncertain outcome after a retry', () => {
    const checks: Array<[Partial<ExecutionEvidence>, string]> = [
      [{ killSwitchActive: true }, 'KILL_SWITCH_ACTIVE'],
      [{ reservedCostCents: 51 }, 'BUDGET_EXCEEDED'],
      [{ credentialsConnected: false }, 'CREDENTIALS_MISSING'],
      [{ outcomeKnown: false }, 'UNCERTAIN_OUTCOME'],
      [{ tenantId: 'default' }, 'TENANT_REQUIRED'],
    ];
    for (const [patch, code] of checks) {
      const res = evaluatePublishGate(evidence({ state: 'rendered', artifact, ...patch }));
      expect(res.ok, code).toBe(false);
      if (!res.ok) expect(res.error).toBe(code);
    }
  });

  it('requires the approved link and target account at publish time', () => {
    const res = evaluatePublishGate(evidence({ state: 'rendered', artifact, affiliateTargetUrl: '' }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('LINK_OR_ACCOUNT_MISSING');
  });

  it('only a verified artifact advances render_queued → rendered', () => {
    const good = evaluateArtifactGate(evidence({ state: 'render_queued', artifact }));
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value.nextState).toBe('rendered');

    const zeroBytes = evaluateArtifactGate(
      evidence({ state: 'render_queued', artifact: { ...artifact, byteSize: 0 } }),
    );
    expect(zeroBytes.ok).toBe(false);
    if (!zeroBytes.ok) expect(zeroBytes.error).toBe('MEDIA_NOT_VERIFIED');
  });
});
