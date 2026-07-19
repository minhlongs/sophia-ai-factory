/**
 * Asserts that en.json and vi.json have identical key shapes.
 * Prevents future PRs from adding keys to one locale without the other.
 *
 * @module src/__tests__/messages-parity
 */

import { describe, it, expect } from 'vitest';
import en from '../../messages/en.json';
import vi from '../../messages/vi.json';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe('messages parity', () => {
  it('en + vi have identical key shape', () => {
    const enKeys = flatten(en as Record<string, unknown>).sort();
    const viKeys = flatten(vi as Record<string, unknown>).sort();
    const missingInVi = enKeys.filter(k => !viKeys.includes(k));
    const missingInEn = viKeys.filter(k => !enKeys.includes(k));
    expect({ missingInVi, missingInEn }).toEqual({ missingInVi: [], missingInEn: [] });
  });
});
