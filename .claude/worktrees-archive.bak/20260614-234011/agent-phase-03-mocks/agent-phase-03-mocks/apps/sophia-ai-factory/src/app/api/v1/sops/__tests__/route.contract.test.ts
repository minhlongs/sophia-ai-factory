/**
 * Contract tests for /api/v1/sops — SOP install schema.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { InstallSchema } from '../route';

// Use z.input for input-side type (before defaults are applied)
type InstallInput = z.input<typeof InstallSchema>;

describe('contract: api/v1/sops', () => {
  describe('InstallSchema', () => {
    const validMinimal: InstallInput = { slug: 'weekly-affiliate-report' };

    it('parses minimal valid body with only slug', () => {
      const result = InstallSchema.parse(validMinimal);
      expect(result.slug).toBe('weekly-affiliate-report');
      expect(result.enabled).toBe(true); // default
    });

    it('parses full body with all optional fields', () => {
      const result = InstallSchema.parse({
        slug: 'daily-campaign-summary',
        scheduleCron: '0 9 * * 1',
        enabled: false,
        configValues: { timezone: 'Asia/Ho_Chi_Minh', recipients: ['ceo@acme.com'] },
      });
      expect(result.scheduleCron).toBe('0 9 * * 1');
      expect(result.enabled).toBe(false);
      expect((result.configValues as Record<string, unknown>).timezone).toBe('Asia/Ho_Chi_Minh');
    });

    it('rejects missing slug — issues[0].path = ["slug"]', () => {
      const result = InstallSchema.safeParse({ enabled: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('slug');
      }
    });

    it('rejects empty slug string — issues[0].code = too_small', () => {
      const result = InstallSchema.safeParse({ slug: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.path).toContain('slug');
        expect(['too_small', 'too_short']).toContain(issue.code);
      }
    });

    it('rejects slug exceeding 100 chars', () => {
      const result = InstallSchema.safeParse({ slug: 'x'.repeat(101) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('slug');
      }
    });

    it('inferred type matches expected shape (compile-time assertion)', () => {
      const input: InstallInput = validMinimal;
      expect(input.slug).toBeDefined();
    });
  });
});
