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
import { TIER_RANK } from '@/seed/types';

const TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

describe('selectableImageModelsForTier', () => {
  it('offers the fal model a BASIC customer can use first as the default', () => {
    const basic = selectableImageModelsForTier('BASIC');
    expect(basic[0]).toBe('fal-ai/flux-schnell');
    expect(basic).toContain('flux-schnell');
  });

  it('places fal-ai models ahead of customer-BYOK MuAPI models for every tier', () => {
    for (const tier of TIERS) {
      const models = selectableImageModelsForTier(tier);
      expect(models[0], `${tier} first model`).toMatch(/^fal-ai\//);
    }
  });

  it('falls back to the BASIC set for an unknown tier', () => {
    expect(selectableImageModelsForTier('UNKNOWN_TIER')).toEqual(
      selectableImageModelsForTier('BASIC'),
    );
  });

  it('returns a non-empty list for every known tier', () => {
    for (const tier of TIERS) {
      expect(selectableImageModelsForTier(tier).length, `${tier} is empty`).toBeGreaterThan(0);
    }
  });

  it('matches the entitlement set in allowedImageModelsForTier', () => {
    for (const tier of TIERS) {
      const allowed = allowedImageModelsForTier(tier);
      const selectable = selectableImageModelsForTier(tier);
      expect(new Set(selectable)).toEqual(new Set(allowed));
    }
  });
});

describe('TIER_ALLOWED_MODELS key parity with the canonical tier list', () => {
  /**
   * The MuAPI spending path admits a request only for a tier that is an own key
   * of `TIER_RANK`, then reads that tier's list from `TIER_ALLOWED_MODELS`. If a
   * key is ever dropped from the second map, the guard still admits the tier and
   * the lookup returns nothing, so a paying tier loses image generation while the
   * refusal message blames the customer's plan. `TIER_ALLOWED_MODELS` is declared
   * `Record<string, string[]>` and so cannot enforce that parity in the type
   * system; this test is the enforcement.
   */
  it('declares an entry for every canonical tier', () => {
    for (const tier of Object.keys(TIER_RANK)) {
      expect(Object.hasOwn(TIER_ALLOWED_MODELS, tier), `${tier} has no model list`).toBe(true);
      expect(TIER_ALLOWED_MODELS[tier].length, `${tier} list is empty`).toBeGreaterThan(0);
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
