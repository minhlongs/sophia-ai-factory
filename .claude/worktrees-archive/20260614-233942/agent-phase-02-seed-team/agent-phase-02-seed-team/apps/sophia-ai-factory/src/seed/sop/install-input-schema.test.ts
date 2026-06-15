/**
 * install-input-schema tests — Zod validation for install + customization inputs.
 */

import { describe, it, expect } from 'vitest';
import { installInputSchema, customizationInputSchema, CRON_PRESETS } from './install-input-schema';

describe('installInputSchema', () => {
  it('accepts valid slug with no schedule (manual)', () => {
    const r = installInputSchema.safeParse({ slug: 'daily-content-factory', enabled: true });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.slug).toBe('daily-content-factory');
      expect(r.data.enabled).toBe(true);
    }
  });

  it('accepts a whitelisted cron preset', () => {
    const r = installInputSchema.safeParse({
      slug: 'reactive-lead-engine',
      scheduleCron: CRON_PRESETS.daily9am,
      enabled: true,
    });
    expect(r.success).toBe(true);
  });

  it('accepts weekly Mon preset', () => {
    const r = installInputSchema.safeParse({
      slug: 'weekly-performance-report',
      scheduleCron: CRON_PRESETS.weeklyMon9am,
      enabled: false,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.enabled).toBe(false);
  });

  it('rejects arbitrary cron string (not in preset list)', () => {
    const r = installInputSchema.safeParse({
      slug: 'daily-content-factory',
      scheduleCron: '*/5 * * * *',
      enabled: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty slug', () => {
    const r = installInputSchema.safeParse({ slug: '', enabled: true });
    expect(r.success).toBe(false);
  });

  it('rejects slug longer than 120 chars', () => {
    const r = installInputSchema.safeParse({ slug: 'a'.repeat(121), enabled: true });
    expect(r.success).toBe(false);
  });

  it('defaults enabled to true when omitted', () => {
    const r = installInputSchema.safeParse({ slug: 'crisis-pr-mode' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.enabled).toBe(true);
  });

  it('accepts null scheduleCron (explicit manual)', () => {
    const r = installInputSchema.safeParse({ slug: 'proposal-auto-pilot', scheduleCron: null });
    expect(r.success).toBe(true);
  });
});

describe('customizationInputSchema', () => {
  it('accepts empty object', () => {
    expect(customizationInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts playbookMdOverride under 32KB', () => {
    const r = customizationInputSchema.safeParse({ playbookMdOverride: '# Hello\n- step 1' });
    expect(r.success).toBe(true);
  });

  it('rejects playbookMdOverride over 32KB', () => {
    const r = customizationInputSchema.safeParse({ playbookMdOverride: 'x'.repeat(32 * 1024 + 1) });
    expect(r.success).toBe(false);
  });

  it('accepts vars as record of unknown', () => {
    const r = customizationInputSchema.safeParse({ vars: { topic: 'tech', lang: 'vi' } });
    expect(r.success).toBe(true);
  });

  it('preserves vars correctly', () => {
    const vars = { city: 'Hanoi', topic: 'AI' };
    const r = customizationInputSchema.safeParse({ vars });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.vars).toEqual(vars);
  });
});
