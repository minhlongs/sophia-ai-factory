/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { classifyBotUserAgent, isPreviewOrCrawlerBot } from '../bot-user-agent';
import { parseLlmJsonWithRepair } from '../schema-aligned-repair';
import { buildDelayedCommentPlugPlan } from '@/forest/publishing/delayed-comment-plug';

describe('ak-xia Moat Wave 1: Bot Filter, SAP JSON Repair & Delayed-Comment Plug', () => {
  it('detects social preview bots & AI crawlers while allowing real mobile/desktop browsers', () => {
    expect(isPreviewOrCrawlerBot('TelegramBot (like TwitterBot)')).toBe(true);
    expect(classifyBotUserAgent('GPTBot/1.2').botCategory).toBe('ai_crawler');
    expect(classifyBotUserAgent('facebookexternalhit/1.1').botCategory).toBe('meta_preview');
    expect(
      isPreviewOrCrawlerBot(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      ),
    ).toBe(false);
  });

  it('repairs markdown-fenced JSON with prose wrappers and trailing commas without burning BYOK retries', () => {
    const messy = 'Here is your campaign JSON:\n```json\n{"title": "Bybit Guide", "hooks": ["A", "B",],}\n```\nHope this helps!';
    const result = parseLlmJsonWithRepair(messy);
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(true);
    expect(result.parsed).toEqual({ title: 'Bybit Guide', hooks: ['A', 'B'] });
  });

  it('strips outbound URLs from main caption and builds a compliant delayed first-comment plug', () => {
    const plan = buildDelayedCommentPlugPlan({
      mainCaption: 'Check out this workflow https://sophia.test/api/r/abc123 for guaranteed profit!',
      ctaText: 'Xem công cụ tại đây:',
      affiliateShortUrl: 'https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/abc123',
      delayMinutes: 4,
      jurisdiction: 'VN',
      platform: 'tiktok',
      vertical: 'crypto',
    });

    expect(plan.cleanMainCaption).not.toContain('https://');
    expect(plan.cleanMainCaption.toLowerCase()).not.toContain('guaranteed profit');
    expect(plan.firstCommentBody).toContain('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/abc123');
    expect(plan.firstCommentBody).toContain('#QuảngCáo');
    expect(plan.delayMinutes).toBe(4);
    expect(plan.executeAtOffsetMs).toBe(240_000);
  });
});
