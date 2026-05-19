/**
 * Contract tests for /api/v1/campaigns/create — RaaS campaign creation schema.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createCampaignBodySchema } from '../route';

type CampaignBody = z.infer<typeof createCampaignBodySchema>;

describe('contract: api/v1/campaigns/create', () => {
  describe('createCampaignBodySchema', () => {
    const validMinimal: CampaignBody = {
      script: 'Hello world, buy our product today!',
      userId: 'user_abc123',
    };

    it('parses minimal valid body', () => {
      const result = createCampaignBodySchema.parse(validMinimal);
      expect(result.script).toBe('Hello world, buy our product today!');
      expect(result.userId).toBe('user_abc123');
    });

    it('parses full body with all optional fields', () => {
      const full: CampaignBody = {
        script: 'Full campaign script',
        title: 'Q1 Launch',
        avatar_id: 'avatar_001',
        voice_id: 'voice_en_001',
        userId: 'user_xyz',
      };
      const result = createCampaignBodySchema.parse(full);
      expect(result.title).toBe('Q1 Launch');
      expect(result.avatar_id).toBe('avatar_001');
    });

    it('rejects missing script — issues[0].path = ["script"]', () => {
      const result = createCampaignBodySchema.safeParse({ userId: 'user_123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('script');
      }
    });

    it('rejects empty script string — issues[0].path = ["script"]', () => {
      const result = createCampaignBodySchema.safeParse({ script: '', userId: 'user_123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('script');
      }
    });

    it('rejects missing userId — issues[0].path = ["userId"]', () => {
      const result = createCampaignBodySchema.safeParse({ script: 'valid script' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('userId');
      }
    });

    it('inferred type matches expected shape (compile-time assertion)', () => {
      const body: CampaignBody = validMinimal;
      expect(body.userId).toBeDefined();
    });
  });
});
