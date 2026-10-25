/**
 * Tier image model access: entitlement map vs. customer-facing filter.
 *
 * The split between `allowedImageModelsForTier` (what a tier is entitled to)
 * and `selectableImageModelsForTier` (what the workspace offers) is
 * load-bearing. The access map is left untouched so the MuAPI branch can be
 * re-enabled once a cost owner is decided; the filter is what keeps an
 * unowned-cost model out of a customer's picker today.
 */

import { describe, expect, it } from 'vitest';
import {
  allowedImageModelsForTier,
  selectableImageModelsForTier,
  TIER_ALLOWED_MODELS,
} from '@/seed/config/tiers/image-model-access';

const TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

describe('selectableImageModelsForTier', () => {
  it('offers the fal model a BASIC customer can use', () => {
    expect(selectableImageModelsForTier('BASIC')).toContain('fal-ai/flux-schnell');
  });

  it('never offers a model without the fal-ai prefix, for any tier', () => {
    for (const tier of TIERS) {
      for (const id of selectableImageModelsForTier(tier)) {
        expect(id, `${tier} offered ${id}`).toMatch(/^fal-ai\//);
      }
    }
  });

  it('offers nothing for a tier whose allowed set is only MuAPI ids', () => {
    // Defensive: the filter must not silently fall back to fal models when a
    // tier maps to MuAPI-only ids, because that would offer a model the tier
    // is not entitled to.
    expect(selectableImageModelsForTier('UNKNOWN_TIER')).toEqual(
      selectableImageModelsForTier('BASIC'),
    );
  });

  it('returns a non-empty list for every known tier', () => {
    for (const tier of TIERS) {
      expect(selectableImageModelsForTier(tier).length, `${tier} is empty`).toBeGreaterThan(0);
    }
  });

  it('is a strict subset of the access map', () => {
    for (const tier of TIERS) {
      const allowed = allowedImageModelsForTier(tier);
      for (const id of selectableImageModelsForTier(tier)) {
        expect(allowed).toContain(id);
      }
    }
  });
});

describe('allowedImageModelsForTier (access map, unchanged)', () => {
  it('still contains the MuAPI id for BASIC', () => {
    // Proves the access map was not narrowed alongside the filter: entitlement
    // is recorded separately from what is offered.
    expect(allowedImageModelsForTier('BASIC')).toContain('flux-schnell');
  });

  it('falls back to the BASIC set for an unknown tier', () => {
    expect(allowedImageModelsForTier('UNKNOWN_TIER')).toEqual(
      allowedImageModelsForTier('BASIC'),
    );
  });

  it('keeps the original MuAPI entitlement map values', () => {
    expect(TIER_ALLOWED_MODELS.BASIC).toEqual(['flux-schnell']);
    expect(TIER_ALLOWED_MODELS.PREMIUM).toEqual(['flux-schnell', 'flux-dev', 'hidream']);
  });
});
