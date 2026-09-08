/**
 * Fal.ai pricing config tests — deterministic, env-isolated.
 *
 * Validates:
 * 1. Known models return correct cents
 * 2. Unknown models return undefined
 * 3. FAL_PRICING_JSON env override works
 * 4. Malformed FAL_PRICING_JSON falls back to static table
 * 5. Negative/zero values rejected by schema
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFalModelPriceCents, DEFAULT_FAL_PRICING } from '../fal-pricing';

describe('fal-pricing', () => {
  const originalEnv = process.env.FAL_PRICING_JSON;

  beforeEach(() => {
    // Clear env override for each test
    delete process.env.FAL_PRICING_JSON;
    // Reset module cache so pricing re-evaluates
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.FAL_PRICING_JSON = originalEnv;
    } else {
      delete process.env.FAL_PRICING_JSON;
    }
  });

  describe('static table', () => {
    it('returns 1 cent for fal-ai/flux-schnell', async () => {
      const mod = await import('../fal-pricing');
      expect(mod.getFalModelPriceCents('fal-ai/flux-schnell')).toBe(1);
    });

    it('returns 3 cents for fal-ai/flux/dev', async () => {
      const mod = await import('../fal-pricing');
      expect(mod.getFalModelPriceCents('fal-ai/flux/dev')).toBe(3);
    });

    it('returns 5 cents for fal-ai/flux-pro', async () => {
      const mod = await import('../fal-pricing');
      expect(mod.getFalModelPriceCents('fal-ai/flux-pro')).toBe(5);
    });

    it('returns undefined for unknown model', async () => {
      const mod = await import('../fal-pricing');
      expect(mod.getFalModelPriceCents('fal-ai/nonexistent')).toBeUndefined();
    });

    it('DEFAULT_FAL_PRICING exposes all three models', () => {
      expect(DEFAULT_FAL_PRICING['fal-ai/flux-schnell']).toBe(1);
      expect(DEFAULT_FAL_PRICING['fal-ai/flux/dev']).toBe(3);
      expect(DEFAULT_FAL_PRICING['fal-ai/flux-pro']).toBe(5);
    });
  });

  describe('env override', () => {
    it('returns override value when FAL_PRICING_JSON is valid', async () => {
      process.env.FAL_PRICING_JSON = JSON.stringify({ 'fal-ai/flux-schnell': 2 });
      const mod = await import('../fal-pricing');
      expect(mod.getFalModelPriceCents('fal-ai/flux-schnell')).toBe(2);
    });

    it('overrides entire table (not merge)', async () => {
      process.env.FAL_PRICING_JSON = JSON.stringify({ 'fal-ai/custom-model': 7 });
      const mod = await import('../fal-pricing');
      expect(mod.getFalModelPriceCents('fal-ai/custom-model')).toBe(7);
      // Static models NOT in override → undefined
      expect(mod.getFalModelPriceCents('fal-ai/flux-schnell')).toBeUndefined();
    });

    it('falls back to static table on malformed JSON', async () => {
      process.env.FAL_PRICING_JSON = 'not-valid-json{{{';
      const mod = await import('../fal-pricing');
      // Should fall back to static, not throw
      expect(mod.getFalModelPriceCents('fal-ai/flux-schnell')).toBe(1);
    });

    it('falls back to static table on schema-violating JSON (negative value)', async () => {
      process.env.FAL_PRICING_JSON = JSON.stringify({ 'fal-ai/flux-schnell': -5 });
      const mod = await import('../fal-pricing');
      // Negative rejected by schema → fallback
      expect(mod.getFalModelPriceCents('fal-ai/flux-schnell')).toBe(1);
    });

    it('falls back to static table on non-object JSON (array)', async () => {
      process.env.FAL_PRICING_JSON = JSON.stringify([1, 2, 3]);
      const mod = await import('../fal-pricing');
      expect(mod.getFalModelPriceCents('fal-ai/flux-schnell')).toBe(1);
    });
  });
});
