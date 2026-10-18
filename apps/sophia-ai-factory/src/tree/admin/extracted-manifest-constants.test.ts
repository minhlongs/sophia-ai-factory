import { describe, expect, it } from 'vitest';
import { SUPABASE_MIGRATIONS_MANIFEST } from './supabase-migrations-manifest';
import { SUPABASE_MIGRATIONS_MANIFEST_RAAS } from './supabase-migrations-manifest-raas';
import { NON_LATIN_LOCALE_BUDGETS } from '../cultural-adaptation/subtitles/budget-profiles-non-latin';

describe('extracted static catalogs', () => {
  it('keeps migration identifiers and checksums unique across manifest modules', () => {
    const all = SUPABASE_MIGRATIONS_MANIFEST;
    const filenames = all.map(({ filename }) => filename);
    expect(new Set(filenames).size).toBe(filenames.length);
    expect(all).toEqual(expect.arrayContaining(SUPABASE_MIGRATIONS_MANIFEST_RAAS));
    expect(all.every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256))).toBe(true);
  });

  it('exposes the expected non-Latin subtitle locale budgets', () => {
    expect(NON_LATIN_LOCALE_BUDGETS.ja?.maxCps).toBe(6);
    expect(NON_LATIN_LOCALE_BUDGETS.th?.wordWrapMode).toBe('character');
    expect(Object.keys(NON_LATIN_LOCALE_BUDGETS)).toEqual(['ja', 'zh', 'ko', 'th', 'ar', 'hi']);
  });
});
