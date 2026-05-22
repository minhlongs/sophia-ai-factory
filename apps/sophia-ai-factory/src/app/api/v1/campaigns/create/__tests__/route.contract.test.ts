/**
 * Contract tests for /api/v1/campaigns/create — RaaS campaign creation schema.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createCampaignBodySchema } from '../route';

type CampaignBody = z.infer<typeof createCampaignBodySchema>;

describe('contract: api/v1/campaigns/create', () => {
  describe('createCampaignBodySchema', () => {
    // userId is now optional in body — identity is derived from the API key's license record.
    const validMinimal: CampaignBody = {
      script: 'Hello world, buy our product today!',
    };

    it('parses minimal valid body without userId', () => {
      const result = createCampaignBodySchema.parse(validMinimal);
      expect(result.script).toBe('Hello world, buy our product today!');
      expect(result.userId).toBeUndefined();
    });

    it('parses body with optional userId (for impersonation check)', () => {
      const result = createCampaignBodySchema.parse({ script: 'Hello', userId: 'user_abc123' });
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
      const result = createCampaignBodySchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('script');
      }
    });

    it('rejects empty script string — issues[0].path = ["script"]', () => {
      const result = createCampaignBodySchema.safeParse({ script: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('script');
      }
    });

    it('accepts body without userId (userId now optional — V-1.2 fix)', () => {
      // userId is no longer required in body; identity comes from the API key
      const result = createCampaignBodySchema.safeParse({ script: 'valid script' });
      expect(result.success).toBe(true);
    });

    it('inferred type has optional userId', () => {
      const body: CampaignBody = validMinimal;
      // userId may be undefined — that is expected post V-1.2 fix
      expect(body.script).toBeDefined();
    });
  });
});
