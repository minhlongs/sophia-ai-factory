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

import { describe, it, expect } from 'vitest';
import {
  resolveSyntheticMediaDisclosure,
  allowsYouTubePublish,
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

  it('surfaces the provenance validity rule instead of inventing a supported claim', () => {
    expect(() => resolveSyntheticMediaDisclosure({
      provenance: {
        sources: [{ ...verifiedSource, status: 'pending' }],
        claims: [supportedClaim],
      },
    })).toThrow(/verified source/);
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
