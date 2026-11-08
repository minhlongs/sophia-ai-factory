/**
 * Publish approval policy — labelled-fixture tests
 *
 * A publish to a public channel is irreversible, so the policy must never
 * release one on a guess. These tests pin the three outcomes and, critically,
 * that an expired or already-used approval is treated as no permission rather
 * than as a permission that is still good.
 *
 * @module tree/publishing/approval/__tests__/publish-approval-decision
 */

import { describe, it, expect } from 'vitest';
import {
  evaluatePublishApprovalPolicy,
  ledgerDecisionAllowsPublish,
  EXPIRED_APPROVAL_REASON,
} from '../decision';
import { canonicalizePublishSubject } from '../idempotency-key';

/** Epoch seconds — the unit the publish ledger stores `expires_at` in. */
const NOW = 1_764_000_000;

const clock = (seconds = NOW) => () => seconds;

describe('evaluatePublishApprovalPolicy', () => {
  it('requires approval for a public publish with no prior decision', () => {
    const state = evaluatePublishApprovalPolicy({ requestedPrivacy: 'public', nowSeconds: clock() });
    expect(state.outcome).toBe('needs_approval');
    if (state.outcome !== 'needs_approval') throw new Error('unreachable');
    expect(state.reason.length).toBeGreaterThan(0);
    expect(state.reasonVi.length).toBeGreaterThan(0);
  });

  it('treats unlisted as public, because it is still reachable by link', () => {
    const state = evaluatePublishApprovalPolicy({ requestedPrivacy: 'unlisted', nowSeconds: clock() });
    expect(state.outcome).toBe('needs_approval');
  });

  it('releases a private publish without asking a human', () => {
    expect(evaluatePublishApprovalPolicy({ requestedPrivacy: 'private', nowSeconds: clock() }).outcome).toBe('allowed');
  });

  it('releases a publish whose caller passed no privacy intent at all', () => {
    expect(evaluatePublishApprovalPolicy({ nowSeconds: clock() }).outcome).toBe('allowed');
  });

  it('releases a publish a workspace explicitly opted out of', () => {
    expect(evaluatePublishApprovalPolicy({
      requestedPrivacy: 'public', approvalDisabled: true, nowSeconds: clock(),
    }).outcome).toBe('allowed');
  });

  it('releases a publish that a human already approved in time', () => {
    expect(evaluatePublishApprovalPolicy({
      requestedPrivacy: 'public',
      existingApproval: { decision: 'approved', expiresAt: NOW + 3600 },
      nowSeconds: clock(),
    }).outcome).toBe('allowed');
  });

  it('blocks a publish whose approval expired, rather than honouring it', () => {
    const state = evaluatePublishApprovalPolicy({
      requestedPrivacy: 'public',
      existingApproval: { decision: 'approved', expiresAt: NOW - 1 },
      nowSeconds: clock(),
    });
    expect(state.outcome).toBe('blocked');
    if (state.outcome !== 'blocked') throw new Error('unreachable');
    expect(state.reason).not.toBe('');
    expect(state.reasonVi).not.toBe('');
  });

  it('treats an expired-or-lapsed ledger decision as no permission at the expiry instant', () => {
    expect(ledgerDecisionAllowsPublish('approved', NOW, clock(NOW))).toBe(false);
  });

  it('allows an approval with no expiry recorded', () => {
    expect(ledgerDecisionAllowsPublish('approved', undefined, clock())).toBe(true);
  });

  it('refuses a rejected approval permanently', () => {
    const state = evaluatePublishApprovalPolicy({
      requestedPrivacy: 'public',
      existingApproval: { decision: 'rejected' },
      nowSeconds: clock(),
    });
    expect(state.outcome).toBe('blocked');
  });

  it('refuses a still-pending approval without re-asking', () => {
    expect(evaluatePublishApprovalPolicy({
      requestedPrivacy: 'public',
      existingApproval: { decision: 'pending' },
      nowSeconds: clock(),
    }).outcome).toBe('needs_approval');
  });

  it('carries a bilingual reason for an approval that lapsed unused', () => {
    expect(EXPIRED_APPROVAL_REASON.reasonVi.length).toBeGreaterThan(0);
  });
});

describe('canonicalizePublishSubject', () => {
  const base = {
    tenantId: 'org_1',
    channelId: 'chan_1',
    platform: 'youtube',
    mediaRef: 'r2://bucket/clip-1.mp4',
  };

  it('trims surrounding whitespace and folds platform case so a retry maps to the same key', () => {
    expect(canonicalizePublishSubject(base)).toBe(canonicalizePublishSubject({
      ...base,
      tenantId: '  org_1 ',
      channelId: ' chan_1 ',
      platform: ' YouTube ',
      mediaRef: ' r2://bucket/clip-1.mp4 ',
    }));
  });

  // Two workspaces whose ids differ only in case are two distinct tenants;
  // folding case on identifiers would let one tenant's decision release or
  // block the other's pending publish.
  it('preserves case on tenantId, channelId, and mediaRef so case-distinct tenants never collide', () => {
    expect(canonicalizePublishSubject(base)).not.toBe(canonicalizePublishSubject({
      ...base,
      tenantId: 'ORG_1',
    }));
    expect(canonicalizePublishSubject(base)).not.toBe(canonicalizePublishSubject({
      ...base,
      mediaRef: 'r2://bucket/CLIP-1.mp4',
    }));
  });

  it('separates every subject field so parts cannot be shuffled into another key', () => {
    const shuffled = canonicalizePublishSubject({
      tenantId: 'org_1chan',
      channelId: 'chan_1',
      platform: 'youtube',
      mediaRef: 'r2://bucket/clip-1.mp4',
    });
    expect(shuffled).not.toBe(canonicalizePublishSubject(base));
  });

  it('changes when the media changes on the same channel', () => {
    expect(canonicalizePublishSubject(base)).not.toBe(canonicalizePublishSubject({
      ...base, mediaRef: 'r2://bucket/clip-2.mp4',
    }));
  });
});
