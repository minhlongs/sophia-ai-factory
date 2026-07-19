/**
 * Unit tests for variant-generator.ts
 *
 * Tests deterministic fallback (no BYOK key) — avoids real LLM calls in CI.
 * LLM path is tested via integration test with BYOK key (optional, skipped in CI).
 */

import { describe, it, expect } from 'vitest';
import { generateVariants } from '../variant-generator';

describe('generateVariants — deterministic fallback (no BYOK key)', () => {
  it('returns two caption variants', async () => {
    const result = await generateVariants({
      originalCaption: 'Make $5000/month with this crypto strategy',
      locale: 'en',
    });
    expect(result.variantACaption).toBeTruthy();
    expect(result.variantBCaption).toBeTruthy();
    expect(result.usedLlm).toBe(false);
  });

  it('variant A equals the original caption in fallback mode', async () => {
    const original = 'Best SaaS affiliate offer 2025';
    const result = await generateVariants({ originalCaption: original, locale: 'en' });
    expect(result.variantACaption).toBe(original);
  });

  it('variant B differs from variant A in fallback mode', async () => {
    const result = await generateVariants({
      originalCaption: 'Earn passive income online',
      locale: 'en',
    });
    expect(result.variantBCaption).not.toBe(result.variantACaption);
  });

  it('generates thumbnail prompts for both variants', async () => {
    const result = await generateVariants({
      originalCaption: 'Top 5 AI tools for business',
      locale: 'en',
    });
    expect(result.variantAThumbPrompt).toBeTruthy();
    expect(result.variantBThumbPrompt).toBeTruthy();
  });

  it('handles empty byokOpenRouterKey string as "no key"', async () => {
    const result = await generateVariants({
      originalCaption: 'Test caption',
      byokOpenRouterKey: '',
      locale: 'en',
    });
    // empty string is falsy → fallback
    expect(result.usedLlm).toBe(false);
  });

  it('truncates very long original captions in thumb prompts', async () => {
    const longCaption = 'A'.repeat(300);
    const result = await generateVariants({
      originalCaption: longCaption,
      locale: 'en',
    });
    // Thumb prompts should not exceed 300 chars each
    expect(result.variantAThumbPrompt.length).toBeLessThanOrEqual(300);
    expect(result.variantBThumbPrompt.length).toBeLessThanOrEqual(300);
  });

  it('handles vi locale without errors', async () => {
    const result = await generateVariants({
      originalCaption: 'Kiếm tiền online',
      locale: 'vi',
    });
    expect(result.variantACaption).toBeTruthy();
    expect(result.usedLlm).toBe(false);
  });
});

describe('generateVariants — schema validation', () => {
  it('throws ZodError on missing required field', async () => {
    // @ts-expect-error intentional invalid input
    await expect(generateVariants({})).rejects.toThrow();
  });

  it('throws ZodError on empty originalCaption', async () => {
    await expect(generateVariants({ originalCaption: '', locale: 'en' })).rejects.toThrow();
  });
});
