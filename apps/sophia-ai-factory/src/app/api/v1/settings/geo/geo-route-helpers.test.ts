/**
 * Tests for the geo settings merge helper.
 *
 * @module app/api/v1/settings/geo/geo-route-helpers.test
 */

import { describe, expect, it } from 'vitest';
import { mergeJurisdiction } from './geo-route-helpers';
import type { GeoSettings } from '@/seed/tenant-settings/defaults';

const RULES: GeoSettings = {
  additionalRules: [{ category: 'crypto', blockedCountries: ['CN'], reason: 'tenant rule' }],
  removedRules: [{ category: 'gambling', country: 'US' }],
};

describe('mergeJurisdiction', () => {
  it('adds the declaration alongside existing rules', () => {
    const result = mergeJurisdiction({ additionalRules: [], removedRules: [] }, 'US');

    expect(result.targetJurisdiction).toBe('US');
    expect(result.additionalRules).toEqual([]);
    expect(result.removedRules).toEqual([]);
  });

  it('preserves existing block rules when writing a declaration', () => {
    const result = mergeJurisdiction(RULES, 'SG');

    expect(result.additionalRules).toEqual(RULES.additionalRules);
    expect(result.removedRules).toEqual(RULES.removedRules);
    expect(result.targetJurisdiction).toBe('SG');
  });

  it('replaces a prior declaration', () => {
    const result = mergeJurisdiction({ ...RULES, targetJurisdiction: 'US' }, 'VN');

    expect(result.targetJurisdiction).toBe('VN');
    expect(result.additionalRules).toEqual(RULES.additionalRules);
  });

  it('removes the key entirely when cleared, leaving an undeclared state', () => {
    const result = mergeJurisdiction({ ...RULES, targetJurisdiction: 'US' }, null);

    expect(result).not.toHaveProperty('targetJurisdiction');
    expect(result.additionalRules).toEqual(RULES.additionalRules);
    expect(result.removedRules).toEqual(RULES.removedRules);
  });

  it('does not mutate the input', () => {
    const input: GeoSettings = { ...RULES, targetJurisdiction: 'US' };
    const snapshot = JSON.stringify(input);

    mergeJurisdiction(input, 'JP');

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
