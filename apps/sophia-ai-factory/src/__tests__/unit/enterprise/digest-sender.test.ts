/**
 * Unit Tests for Executive BI Digest Senders & Dispatcher.
 *
 * Covers:
 * 1. Telegram MarkdownV2 escaping, formatting, and safe splitting
 * 2. Telegram executive digest sender with fallback on parse error
 * 3. Email digest HTML formatting (2x2 KPI grid + semantic list + agency branding)
 * 4. Email executive digest delivery & dry-run safety
 * 5. Executive digest orchestrator (dispatchExecutiveDigest)
 *
 * @module __tests__/unit/enterprise/digest-sender.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  escapeTelegramMarkdownV2,
  formatTelegramDigest,
  splitTelegramMarkdownV2,
  sendTelegramExecutiveDigest,
} from '@/forest/bi/telegram-digest-sender';
import {
  formatEmailDigest,
  sendEmailExecutiveDigest,
  renderExecutiveDigestInnerHtml,
} from '@/forest/bi/email-digest-sender';
import { dispatchExecutiveDigest } from '@/forest/bi/executive-digest-dispatcher';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';
import type { ExecutiveBIMetricsSummary } from '@/seed/types/executive-bi';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Unit Tests: Executive BI Digest Senders & Dispatcher', () => {
  const sampleMetrics: ExecutiveBIMetricsSummary = {
    orgId: 'org_test_1',
    periodStart: 1717200000000,
    periodEnd: 1719791999000,
    mrrCents: 543200,
    throughputCount: 142,
    viralScore: 89.5,
    affiliateRevenueCents: 1250000,
    marketingSpendCents: 350000,
    roiRatio: 3.57,
  };

  describe('1. Telegram MarkdownV2 Escaper & Formatter', () => {
    it('strictly escapes all 18 MarkdownV2 reserved characters', () => {
      const allSpecials = '_ * [ ] ( ) ~ ` > # + - = | { } . !';
      const expected = '\\_ \\* \\[ \\] \\( \\) \\~ \\` \\> \\# \\+ \\- \\= \\| \\{ \\} \\. \\!';
      expect(escapeTelegramMarkdownV2(allSpecials)).toBe(expected);
      expect(escapeTelegramMarkdownV2('\\')).toBe('\\\\');
    });

    it('formats Telegram digest with agency name and key performance indicators', () => {
      const formatted = formatTelegramDigest(sampleMetrics, {
        agencyName: 'Apex Viral Agency',
      });

      expect(formatted).toContain('Apex Viral Agency');
      expect(formatted).toContain('5432\\.00');
      expect(formatted).toContain('142 videos');
      expect(formatted).toContain('89\\.5/100');
      expect(formatted).toContain('12500\\.00');
      expect(formatted).toContain('3500\\.00');
      expect(formatted).toContain('3\\.57x');
      expect(formatted.length).toBeLessThan(4096);
    });

    it('falls back to Sophia AI Factory when agency branding is absent', () => {
      const formatted = formatTelegramDigest(sampleMetrics);
      expect(formatted).toContain('Sophia AI Factory');
    });

    it('formats currency amounts from integer cents accurately', () => {
      const lowMetrics: ExecutiveBIMetricsSummary = {
        ...sampleMetrics,
        mrrCents: 99,
        affiliateRevenueCents: 10000,
        marketingSpendCents: 50,
      };
      const formatted = formatTelegramDigest(lowMetrics);
      expect(formatted).toContain('0\\.99');
      expect(formatted).toContain('100\\.00');
      expect(formatted).toContain('0\\.50');
    });
  });

  describe('2. Telegram Safe Chunk Splitting (splitTelegramMarkdownV2)', () => {
    it('returns single chunk when text is under maxLength', () => {
      const text = 'Short message';
      expect(splitTelegramMarkdownV2(text, 100)).toEqual(['Short message']);
    });

    it('splits text on natural boundaries without exceeding maxLength', () => {
      const p1 = 'Paragraph 1 content here.';
      const p2 = 'Paragraph 2 content here.';
      const combined = `${p1}\n\n${p2}`;

      const chunks = splitTelegramMarkdownV2(combined, 35);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0]).toBe(p1);
      expect(chunks[1]).toBe(p2);
    });

    it('guards against splitting inside an escape sequence with odd trailing backslash', () => {
      const text = 'Hello \\. World';
      // Cut right at the backslash
      const chunks = splitTelegramMarkdownV2(text, 7);
      // Ensures the escape and escaped dot stay together
      expect(chunks[0].endsWith('\\')).toBe(false);
    });
  });

  describe('3. Telegram Executive Digest Sender', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('skips delivery when botToken or chatId is missing (dry-run safe)', async () => {
      const res = await sendTelegramExecutiveDigest({}, sampleMetrics);
      expect(res.skipped).toBe(true);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('missing_credentials');
    });

    it('dispatches successfully when fetch returns HTTP 200', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 999 } }),
      });
      globalThis.fetch = mockFetch;

      const res = await sendTelegramExecutiveDigest(
        { botToken: 'mock_token', chatId: '12345' },
        sampleMetrics,
      );

      expect(res.success).toBe(true);
      expect(res.messageIds).toContain(999);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('falls back to plain text when MarkdownV2 parse error occurs', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First attempt: MarkdownV2 parse failure
          return {
            ok: false,
            status: 400,
            text: async () => "Bad Request: can't parse entities: Character '.' is reserved",
          };
        }
        // Second attempt: Plain text fallback success
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 1001 } }),
        };
      });
      globalThis.fetch = mockFetch;

      const res = await sendTelegramExecutiveDigest(
        { botToken: 'mock_token', chatId: '12345' },
        sampleMetrics,
      );

      expect(res.success).toBe(true);
      expect(res.messageIds).toContain(1001);
      expect(callCount).toBe(2);
    });
  });

  describe('4. Email Executive Digest Formatter & Sender', () => {
    it('renders 2x2 KPI grid and semantic list in inner HTML', () => {
      const innerHtml = renderExecutiveDigestInnerHtml(sampleMetrics, {
        locale: 'en',
      });

      expect(innerHtml).toContain('Monthly Recurring Revenue');
      expect(innerHtml).toContain('$5432.00');
      expect(innerHtml).toContain('142 videos');
      expect(innerHtml).toContain('89.5/100');
      expect(innerHtml).toContain('3.57x');
      expect(innerHtml).toContain('<li>Monthly Recurring Revenue: $5432.00</li>');
      expect(innerHtml).toContain('<li>Videos Produced: 142</li>');
      expect(innerHtml).toContain('<li>Average Viral Engagement: 89.5/100</li>');
      expect(innerHtml).toContain('<li>Affiliate ROI: 3.57x</li>');
    });

    it('wraps HTML digest in agency branding via formatEmailDigest', () => {
      const formatted = formatEmailDigest(sampleMetrics, {
        agencyName: 'Vanguard Media Group',
        primaryColor: '#3b82f6',
        logoUrl: 'https://vanguard.com/logo.png',
      });

      expect(formatted).toContain('Vanguard Media Group');
      expect(formatted).toContain('#3b82f6');
      expect(formatted).toContain('https://vanguard.com/logo.png');
      expect(formatted).toContain('Monthly Recurring Revenue');
    });

    it('operates in dry-run mode when RESEND_API_KEY is not configured', async () => {
      const prevKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      const res = await sendEmailExecutiveDigest(
        undefined,
        'ceo@agency.com',
        sampleMetrics,
      );

      expect(res.provider).toBe('dry-run');
      expect(res.error).toBe('RESEND_API_KEY not configured');

      if (prevKey) process.env.RESEND_API_KEY = prevKey;
    });

    it('returns error if recipientEmail is empty', async () => {
      const res = await sendEmailExecutiveDigest(
        'key_123',
        '',
        sampleMetrics,
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain('RECIPIENT_REQUIRED');
    });
  });

  describe('5. Executive Digest Dispatcher Orchestrator', () => {
    let db: ReturnType<typeof makeD1>;
    const orgId = 'org_dispatch_test';

    beforeEach(() => {
      const raw = new DatabaseSync(':memory:');
      raw.exec(`
        CREATE TABLE IF NOT EXISTS organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          tier TEXT NOT NULL DEFAULT 'master',
          status TEXT NOT NULL DEFAULT 'active',
          max_seats INTEGER NOT NULL DEFAULT 999,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS org_invitations (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          token_hash TEXT UNIQUE NOT NULL,
          expires_at INTEGER NOT NULL,
          accepted_at INTEGER DEFAULT NULL,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'accepted'
        );

        CREATE TABLE IF NOT EXISTS executive_bi_metrics (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          period_start INTEGER NOT NULL,
          period_end INTEGER NOT NULL,
          mrr_cents INTEGER NOT NULL DEFAULT 0,
          throughput_count INTEGER NOT NULL DEFAULT 0,
          viral_score REAL NOT NULL DEFAULT 0,
          affiliate_revenue_cents INTEGER NOT NULL DEFAULT 0,
          marketing_spend_cents INTEGER NOT NULL DEFAULT 0,
          channel TEXT DEFAULT NULL,
          created_at INTEGER NOT NULL
        );
      `);

      // Seed organization and owner
      raw.exec(`
        INSERT INTO organizations (id, name, slug, tier, status, max_seats, created_at, updated_at)
        VALUES ('${orgId}', 'Alpha Agency', 'alpha-agency', 'master', 'active', 999, 1000, 1000);

        INSERT INTO org_invitations (id, org_id, email, role, token_hash, expires_at, created_by, created_at, status)
        VALUES ('inv_1', '${orgId}', 'owner@alpha.com', 'owner', 'hash_123', 9999999999, 'user_1', 1000, 'accepted');

        INSERT INTO executive_bi_metrics (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
        VALUES ('bi_1', '${orgId}', ${Date.now() - 86400000}, ${Date.now()}, 400000, 50, 90.0, 800000, 200000, ${Date.now()});
      `);

      db = makeD1(raw as unknown as InstanceType<typeof DatabaseSync>);
    });

    it('dispatches digests across active organizations and produces delivery receipt', async () => {
      const receipt = await dispatchExecutiveDigest(db as unknown as D1Database, 'weekly', {
        orgId,
      });

      expect(receipt.cadence).toBe('weekly');
      expect(receipt.totalOrgs).toBe(1);
      expect(receipt.details).toHaveLength(1);
      expect(receipt.details[0].orgId).toBe(orgId);
      expect(receipt.details[0].emailSuccess).toBe(true);
    });

    it('handles empty organizations list gracefully', async () => {
      const receipt = await dispatchExecutiveDigest(db as unknown as D1Database, 'monthly', {
        orgId: 'non_existent_org',
      });

      expect(receipt.totalOrgs).toBe(0);
      expect(receipt.details).toHaveLength(0);
    });
  });
});
