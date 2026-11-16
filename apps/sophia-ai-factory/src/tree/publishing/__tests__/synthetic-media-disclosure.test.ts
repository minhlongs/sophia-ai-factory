/**
 * Synthetic-media disclosure — labelled-fixture tests
 *
 * This is the module that decides whether a YouTube upload carries
 * `status.containsSyntheticMedia`. A missing disclosure costs the channel
 * owner monetization, so the default must be disclosure-on; an unresolved
 * provenance claim is a strike risk, so it must stop the publish rather than
 * warn about it.
 *
 * @module tree/publishing/__tests__/synthetic-media-disclosure
 */

import { describe, it, expect, vi } from 'vitest';
import { logger } from '@/seed/utils/logger-utility';
import {
  resolveSyntheticMediaDisclosure,
  allowsYouTubePublish,
  assertYouTubeProvenanceAllowed,
  isProvenanceBlockedError,
  ProvenanceBlockedError,
} from '../synthetic-media-disclosure';

const verifiedSource = {
  id: 'src_1',
  url: 'https://example.gov/report',
  title: 'Official report',
  publisher: 'Example Gov',
  sourceType: 'official',
  status: 'verified',
};

const supportedClaim = {
  id: 'claim_1',
  text: 'Sea levels rose 3.7 mm per year.',
  riskLevel: 'standard',
  sourceIds: ['src_1'],
  status: 'supported',
};

describe('resolveSyntheticMediaDisclosure', () => {
  it('discloses synthetic media when the caller passes nothing at all', () => {
    const disclosure = resolveSyntheticMediaDisclosure();

    expect(disclosure.containsSyntheticMedia).toBe(true);
    expect(disclosure.blocked).toBe(false);
  });

  it('defaults to disclosure when the provenance record omits the flag', () => {
    const disclosure = resolveSyntheticMediaDisclosure({
      provenance: { sources: [verifiedSource], claims: [supportedClaim] },
    });

    // The provenance record has no declaration of its own, so the default
    // disclosure for generated content applies.
    expect(disclosure.containsSyntheticMedia).toBe(true);
    expect(disclosure.provenanceStatus).toBe('verified');
  });

  it('preserves default disclosure when containsSyntheticMedia is explicitly undefined on provenance', () => {
    const disclosure = resolveSyntheticMediaDisclosure({
      provenance: {
        sources: [verifiedSource],
        claims: [supportedClaim],
        containsSyntheticMedia: undefined,
      },
    });

    expect(disclosure.containsSyntheticMedia).toBe(true);
    expect(disclosure.provenanceStatus).toBe('verified');
  });

  it('honours an explicit synthetic-media declaration in the provenance record', () => {
    const disclosure = resolveSyntheticMediaDisclosure({
      provenance: {
        sources: [verifiedSource],
        claims: [supportedClaim],
        containsSyntheticMedia: false,
      },
    });

    expect(disclosure.containsSyntheticMedia).toBe(false);
    expect(disclosure.blocked).toBe(false);
  });

  it('allows a publish with no claims at all', () => {
    const disclosure = resolveSyntheticMediaDisclosure({ provenance: { sources: [] } });

    expect(disclosure.provenanceStatus).toBe('not_required');
    expect(disclosure.blocked).toBe(false);
  });

  it('blocks a publish when a claim is left unsupported', () => {
    const disclosure = resolveSyntheticMediaDisclosure({
      provenance: {
        sources: [verifiedSource],
        claims: [{ ...supportedClaim, id: 'claim_2', status: 'unsupported', sourceIds: [] }],
      },
    });

    expect(disclosure.blocked).toBe(true);
    expect(allowsYouTubePublish(disclosure)).toBe(false);
    expect(disclosure.unresolvedClaimCount).toBe(1);
    expect(disclosure.blockedReason).not.toBe('');
    expect(disclosure.blockedReasonVi).not.toBe('');
  });

  it('does not block when every claim is supported by a verified source', () => {
    const disclosure = resolveSyntheticMediaDisclosure({
      provenance: { sources: [verifiedSource], claims: [supportedClaim] },
    });

    expect(disclosure.provenanceStatus).toBe('verified');
    expect(allowsYouTubePublish(disclosure)).toBe(true);
    expect(disclosure.blockedReason).toBeUndefined();
  });

  it('surfaces the provenance validity rule as a PROVENANCE_BLOCKED error instead of inventing a supported claim', () => {
    let thrown: unknown;
    try {
      resolveSyntheticMediaDisclosure({
        provenance: {
          sources: [{ ...verifiedSource, status: 'pending' }],
          claims: [supportedClaim],
        },
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ProvenanceBlockedError);
    expect((thrown as Error).message).toMatch(/verified source/);
    expect(isProvenanceBlockedError(thrown)).toBe(true);
  });

  it('logs a warning and keeps wrapped structural provenance errors within 200 characters without clipping Vietnamese text', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const longUrl = `https://example.gov/reports/${'segment-'.repeat(30)}final`;

    let thrown: unknown;
    try {
      resolveSyntheticMediaDisclosure({
        provenance: {
          sources: [
            { ...verifiedSource, id: 'src_dup_1', url: longUrl },
            { ...verifiedSource, id: 'src_dup_2', url: longUrl },
          ],
          claims: [],
        },
      });
    } catch (err) {
      thrown = err;
    } finally {
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    }

    expect(thrown).toBeInstanceOf(ProvenanceBlockedError);
    const msg = (thrown as Error).message;
    expect(isProvenanceBlockedError(thrown)).toBe(true);
    expect(msg.length).toBeLessThanOrEqual(200);
    expect(msg).toMatch(/Duplicate source URL/);
    expect(msg).toMatch(/\(Hồ sơ nguồn xác minh không hợp lệ\)$/);
  });

  it('keeps the bilingual PROVENANCE_BLOCKED message within 200 characters so error sanitizers never clip it', () => {
    const disclosure = resolveSyntheticMediaDisclosure({
      provenance: {
        sources: [verifiedSource],
        claims: [{ ...supportedClaim, id: 'claim_2', status: 'unsupported', sourceIds: [] }],
      },
    });

    let thrown: unknown;
    try {
      assertYouTubeProvenanceAllowed(disclosure);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ProvenanceBlockedError);
    const msg = (thrown as Error).message;
    expect(isProvenanceBlockedError(thrown)).toBe(true);
    expect(msg.length).toBeLessThanOrEqual(200);
    expect(msg).toMatch(/without a verified source/);
    expect(msg).toMatch(/chưa xác minh được nguồn.*\)$/);
  });
});

describe('allowsYouTubePublish', () => {
  it('permits only an unblocked disclosure', () => {
    expect(allowsYouTubePublish(resolveSyntheticMediaDisclosure())).toBe(true);
    expect(allowsYouTubePublish(resolveSyntheticMediaDisclosure({
      provenance: {
        sources: [verifiedSource],
        claims: [{ ...supportedClaim, status: 'unsupported', sourceIds: [] }],
      },
    }))).toBe(false);
  });
});
