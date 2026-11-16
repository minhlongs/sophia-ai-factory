/**
 * Tier allowlist and parity regression tests for image model access.
 *
 * `tier` crosses layer boundaries as an unvalidated value (`string` in types,
 * arbitrary runtime value from a future caller). Only canonical own-property
 * keys of `TIER_RANK` may resolve to a model list:
 *  - Unknown strings, lowercase/whitespace variants, and non-strings must
 *    return `[]` rather than silently inheriting BASIC's models.
 *  - Inherited `Object.prototype` keys (`__proto__`, `constructor`,
 *    `toString`, `valueOf`, `hasOwnProperty`) must be rejected rather than
 *    resolving to non-array prototype members on `Record<string, readonly string[]>`.
 *  - `TIER_ALLOWED_FAL_MODELS` and `TIER_ALLOWED_MODELS` must declare a
 *    non-empty own-property list for every canonical `TIER_RANK` key and stay
 *    frozen against in-process mutation.
 */

import { describe, expect, it } from 'vitest';
import {
  allowedImageModelsForTier,
  describeImageTier,
  isKnownImageTier,
  selectableImageModelsForTier,
  TIER_ALLOWED_FAL_MODELS,
  TIER_ALLOWED_MODELS,
} from '@/seed/config/tiers/image-model-access';
import { TIER_RANK } from '@/seed/types';

const CANONICAL_TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

const REJECTED_TIERS: Array<[string, unknown, string]> = [
  ['an unrecognised plan name', 'ULTRAMAX', 'ULTRAMAX'],
  ['an empty string', '', ''],
  ['a lowercase canonical name', 'basic', 'basic'],
  ['a whitespace-padded canonical name', ' BASIC ', ' BASIC '],
  ['a trailing-newline canonical name', 'BASIC\n', 'BASIC\n'],
  ['null', null, 'null'],
  ['undefined', undefined, 'undefined'],
  ['a numeric value', 1, '1'],
  ['a boolean value', true, 'true'],
  ['a BigInt value', 1n, '1'],
  ['a Symbol value', Symbol('BASIC'), 'Symbol(BASIC)'],
  ['a plain object', {}, 'object'],
  ['a single-element canonical-name array', ['MASTER'], 'object'],
  ['a canonical-name toString object', { toString: (): string => 'MASTER' }, 'object'],
  ['a null-prototype object', Object.create(null), 'object'],
  [
    'an object with a throwing toString',
    {
      toString(): string {
        throw new Error('hostile toString');
      },
    },
    'object',
  ],
  ['the inherited __proto__ key', '__proto__', '__proto__'],
  ['the inherited constructor key', 'constructor', 'constructor'],
  ['the inherited toString key', 'toString', 'toString'],
  ['the inherited valueOf key', 'valueOf', 'valueOf'],
  ['the inherited hasOwnProperty key', 'hasOwnProperty', 'hasOwnProperty'],
];

describe('isKnownImageTier', () => {
  it.each(CANONICAL_TIERS)('accepts canonical tier %s', (tier) => {
    expect(isKnownImageTier(tier)).toBe(true);
  });

  it.each(REJECTED_TIERS)('rejects %s', (_label, tier) => {
    expect(isKnownImageTier(tier)).toBe(false);
  });
});

describe('describeImageTier', () => {
  it.each(REJECTED_TIERS)(
    'formats %s to exact expected label without invoking object hooks',
    (_label, tier, expected) => {
      expect(describeImageTier(tier)).toBe(expected);
    },
  );

  it('truncates oversized string and symbol labels to 64 characters', () => {
    const longTier = 'X'.repeat(200);
    expect(describeImageTier(longTier)).toBe('X'.repeat(64));
    expect(describeImageTier(Symbol(longTier)).length).toBe(64);
  });
});

describe('allowedImageModelsForTier and selectableImageModelsForTier reject non-canonical tiers', () => {
  it.each(REJECTED_TIERS)(
    'returns an empty model list for %s instead of falling back to BASIC or throwing',
    (_label, tier) => {
      expect(allowedImageModelsForTier(tier as string)).toEqual([]);
      expect(selectableImageModelsForTier(tier as string)).toEqual([]);
    },
  );
});

describe('TIER_ALLOWED_FAL_MODELS and TIER_ALLOWED_MODELS key parity and immutability', () => {
  it('declares a non-empty frozen own-property list for every canonical tier on both maps', () => {
    expect(Object.isFrozen(TIER_ALLOWED_FAL_MODELS)).toBe(true);
    expect(Object.isFrozen(TIER_ALLOWED_MODELS)).toBe(true);

    for (const tier of Object.keys(TIER_RANK)) {
      expect(Object.hasOwn(TIER_ALLOWED_FAL_MODELS, tier), `${tier} missing from fal map`).toBe(
        true,
      );
      expect(TIER_ALLOWED_FAL_MODELS[tier].length, `${tier} fal list is empty`).toBeGreaterThan(0);
      expect(Object.isFrozen(TIER_ALLOWED_FAL_MODELS[tier])).toBe(true);

      expect(Object.hasOwn(TIER_ALLOWED_MODELS, tier), `${tier} missing from MuAPI map`).toBe(true);
      expect(TIER_ALLOWED_MODELS[tier].length, `${tier} MuAPI list is empty`).toBeGreaterThan(0);
      expect(Object.isFrozen(TIER_ALLOWED_MODELS[tier])).toBe(true);
    }
  });
});
