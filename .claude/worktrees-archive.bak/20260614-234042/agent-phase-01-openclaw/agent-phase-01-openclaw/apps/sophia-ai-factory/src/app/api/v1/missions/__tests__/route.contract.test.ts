/**
 * Contract tests for /api/v1/missions — Mission Engine input schemas.
 */

import { describe, it, expect } from 'vitest';
import { CreateMissionSchema, ListQuerySchema } from '../route';

describe('contract: api/v1/missions', () => {
  describe('CreateMissionSchema', () => {
    it('parses minimal valid body', () => {
      const result = CreateMissionSchema.parse({ command: 'generate_report' });
      expect(result.command).toBe('generate_report');
      expect(result.params).toEqual({});
    });

    it('parses full body with webhook_url and params', () => {
      const result = CreateMissionSchema.parse({
        command: 'send_campaign',
        params: { audience: 'all' },
        webhook_url: 'https://example.com/hook',
      });
      expect(result.webhook_url).toBe('https://example.com/hook');
      expect(result.params).toEqual({ audience: 'all' });
    });

    it('rejects empty command string — issues[0].path = ["command"]', () => {
      const result = CreateMissionSchema.safeParse({ command: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('command');
      }
    });

    it('rejects invalid webhook_url — issues[0].path = ["webhook_url"]', () => {
      const result = CreateMissionSchema.safeParse({
        command: 'run',
        webhook_url: 'not-a-url',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('webhook_url');
      }
    });
  });

  describe('ListQuerySchema', () => {
    it('parses query with all fields', () => {
      const result = ListQuerySchema.parse({ status: 'pending', limit: '50', cursor: '123' });
      expect(result.limit).toBe(50);
      expect(result.status).toBe('pending');
    });

    it('applies default limit of 20 when omitted', () => {
      const result = ListQuerySchema.parse({});
      expect(result.limit).toBe(20);
    });

    it('rejects limit above 100', () => {
      const result = ListQuerySchema.safeParse({ limit: '200' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('limit');
      }
    });
  });
});
