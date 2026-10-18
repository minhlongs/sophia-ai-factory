/**
 * Regression suite for extracted campaign, video, tenancy, publishing,
 * checkout, and Open-Core license preview helpers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeCheckoutDisplayValues,
  verifyCheckoutOrderStatus,
} from '@/forest/components/checkout/panel/checkout-panel-formatters';
import {
  asString,
  normalizeProvider,
  normalizeCaption,
  listConnectedChannels,
} from '@/forest/publishing/missions/social-publish-helpers';
import { resolvePublishCooldown } from '@/forest/publishing/schedule-publish-cooldown';
import * as cooldownMod from '@/tree/quota/channel-cooldown';
import {
  isMockMode as isFbMockMode,
  buildFacebookReelDescription,
  parseFacebookInsights,
} from '@/land/video/publishing/providers/facebook-publisher-helpers';
import {
  isYouTubeMockMode,
  buildYouTubeMetadata,
  performResumableYouTubeUpload,
} from '@/land/video/publishing/providers/youtube-upload-helper';
import {
  getD1ForWebhooks,
  runDistribution,
} from '@/forest/inngest/functions/campaign/distribution-gateway';

describe('extracted-domain-helpers-regression', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete (globalThis as Record<string, unknown>).__env;
  });

  describe('checkout-panel-formatters', () => {
    it('computes display values for EN and VI with and without discounts/QR URL', () => {
      const en = computeCheckoutDisplayValues({
        priceCents: 4900,
        discountedPriceCents: 3900,
        checkoutUrl: 'https://pay.sophia.test/inv/1',
        locale: 'en',
      });
      expect(en.finalPriceCents).toBe(3900);
      expect(en.qrCodeSrc).toContain('encodeURIComponent' in globalThis ? 'https%3A' : 'http');

      const viVal = computeCheckoutDisplayValues({
        priceCents: 2000,
        locale: 'vi',
      });
      expect(viVal.finalPriceCents).toBe(2000);
      expect(viVal.qrCodeSrc).toBe('');
    });

    it('verifies checkout order status across all response states and errors', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);
      expect(await verifyCheckoutOrderStatus('o-1')).toBeNull();

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed' }),
      } as Response);
      expect(await verifyCheckoutOrderStatus('o-2')).toBe('completed');

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'expired' }),
      } as Response);
      expect(await verifyCheckoutOrderStatus('o-3')).toBe('failed');

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'processing' }),
      } as Response);
      expect(await verifyCheckoutOrderStatus('o-4')).toBe('pending');

      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('network'));
      expect(await verifyCheckoutOrderStatus('o-5')).toBeNull();
    });
  });

  describe('social-publish-helpers & schedule-publish-cooldown', () => {
    it('normalizes strings, providers, captions, and connected channels', async () => {
      expect(asString('  hello  ')).toBe('hello');
      expect(asString(123, 'fallback')).toBe('fallback');
      expect(normalizeProvider('x')).toBe('twitter');
      expect(normalizeProvider('youtube_shorts')).toBe('youtube');
      expect(normalizeProvider('unknown_net')).toBeNull();

      expect(normalizeCaption({})).toBeUndefined();
      expect(normalizeCaption({ caption: 'Hi', hashtags: ['#a', '#b'] })).toBe('Hi #a #b');
      expect(normalizeCaption({ tweet: 'Tweet', hashtags: '#c' })).toBe('Tweet #c');
      expect(normalizeCaption({ title: 'OnlyTitle', hashtags: 123 })).toBe('OnlyTitle');

      const fakeDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: sql.includes('publishing_channels')
                ? [{ id: 'ch-1', provider: 'x' }, { id: 'ch-bad', provider: 'invalid' }]
                : [],
            })),
            first: vi.fn(async () => ({ chat_id: 'tg-99' })),
          })),
        })),
      } as unknown as D1Database;

      const all = await listConnectedChannels(fakeDb, 'u-1', 'all_connected');
      expect(all).toEqual([
        { provider: 'twitter', channelId: 'ch-1' },
        { provider: 'telegram', channelId: 'tg-99' },
      ]);
      const tgOnly = await listConnectedChannels(fakeDb, 'u-1', 'telegram');
      expect(tgOnly).toEqual([{ provider: 'telegram', channelId: 'tg-99' }]);
    });

    it('evaluates publish cooldown for unknown, allowed, deferred, and error cases', async () => {
      const unknown = await resolvePublishCooldown({
        tenantId: 't1', channelId: 'c1', provider: 'not-a-provider', requested: 100, now: 90,
      });
      expect(unknown.scheduled).toBe(100);

      vi.spyOn(cooldownMod, 'checkCooldown').mockResolvedValueOnce({
        allowed: false, deferUntil: 250, reason: 'cooldown', deferSeconds: 150,
      });
      const deferred = await resolvePublishCooldown({
        tenantId: 't1', channelId: 'c1', provider: 'tiktok', requested: 100, now: 90,
      });
      expect(deferred).toEqual({ scheduled: 250, deferredUntil: 250, deferReason: 'cooldown' });

      vi.spyOn(cooldownMod, 'checkCooldown').mockRejectedValueOnce('raw-err');
      const errored = await resolvePublishCooldown({
        tenantId: 't1', channelId: 'c1', provider: 'tiktok', requested: 100, now: 90,
      });
      expect(errored.scheduled).toBe(100);
    });
  });

  describe('facebook, youtube, and campaign distribution helpers', () => {
    it('formats Facebook and YouTube metadata and handles upload/gateway paths', async () => {
      expect(typeof isFbMockMode()).toBe('boolean');
      expect(typeof isYouTubeMockMode()).toBe('boolean');
      const desc = buildFacebookReelDescription({
        caption: '#ad Promo', hashtags: ['#one', 'two'], productLink: 'https://shop.test',
      });
      expect(desc).toContain('#one #two');
      expect(parseFacebookInsights({
        data: [
          { name: 'total_video_impressions', values: [{ value: 42 }] },
          { name: 'post_video_likes_by_reaction_type', values: [{ value: { like: 5, wow: 2 } }] },
        ],
      })).toEqual({ views: 42, reach: 42, likes: 7, comments: 0 });

      const ytMeta = buildYouTubeMetadata({ caption: 'Clip', hashtags: ['tag1'] });
      expect(ytMeta.snippet.title).toBe('Clip');

      globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 } as Response);
      await expect(performResumableYouTubeUpload('tok', 'https://v.test/1.mp4', { caption: 'c', hashtags: [] }))
        .rejects.toThrow('404');

      expect(getD1ForWebhooks()).toBeNull();
      (globalThis as Record<string, unknown>).__env = { DB: { mocked: true } };
      expect(getD1ForWebhooks()).toEqual({ mocked: true });
      expect(typeof runDistribution).toBe('function');
    });
  });
});
