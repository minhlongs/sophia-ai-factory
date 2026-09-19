import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockDbFrom: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbEq: vi.fn(),
  mockDbMaybeSingle: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockD1Prepare: vi.fn(),
  mockRecordPerformanceEventIdempotent: vi.fn(),
  mockWriteConversionRevenueEvent: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: mocks.mockDbFrom,
  }),
  getD1: vi.fn().mockImplementation(async () => ({
    prepare: mocks.mockD1Prepare,
  })),
}));

vi.mock('@/tree/performance/events', () => ({
  recordPerformanceEventIdempotent: mocks.mockRecordPerformanceEventIdempotent,
}));

vi.mock('@/land/analytics/tiktok-revenue-ingestion', () => ({
  writeConversionRevenueEvent: mocks.mockWriteConversionRevenueEvent,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST as youtubeNotificationPOST } from '@/app/api/webhooks/youtube-notification/route';
import { POST as tiktokNotificationPOST } from '@/app/api/webhooks/tiktok-notification/route';
import { POST as tiktokShopPOST } from '@/app/api/webhooks/tiktok-shop/route';

describe('Webhook Viral Performance Metrics Ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.YOUTUBE_WEBHOOK_SECRET;
    delete process.env.TIKTOK_WEBHOOK_SECRET;
    delete process.env.TIKTOK_SHOP_WEBHOOK_SECRET;

    mocks.mockDbFrom.mockReturnValue({
      select: mocks.mockDbSelect,
      update: mocks.mockDbUpdate,
    });
    mocks.mockDbSelect.mockReturnValue({ eq: mocks.mockDbEq });
    mocks.mockDbEq.mockReturnValue({ maybeSingle: mocks.mockDbMaybeSingle });
    mocks.mockDbUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });

    mocks.mockRecordPerformanceEventIdempotent.mockResolvedValue(true);
    mocks.mockWriteConversionRevenueEvent.mockResolvedValue({ written: 1, skipped: 0 });
  });

  describe('youtube-notification webhook', () => {
    it('updates publishing_results and records engagement performance event', async () => {
      mocks.mockDbMaybeSingle.mockResolvedValueOnce({
        data: { id: 101, tenant_id: 'tenant-yt-1', metrics_json: null },
      });

      const body = JSON.stringify({
        videoId: 'yt-vid-999',
        statistics: {
          viewCount: '5000',
          likeCount: '350',
          commentCount: '45',
        },
      });

      const req = new Request('https://sophia.agencyos.network/api/webhooks/youtube-notification', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await youtubeNotificationPOST(req);
      const json = await res.json();
      expect(json).toEqual({ ok: true });

      // publishing_results update verified
      expect(mocks.mockDbUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics_json: expect.stringContaining('"views":5000'),
        }),
      );

      // performance_events record verified
      expect(mocks.mockRecordPerformanceEventIdempotent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'tenant-yt-1',
          assetId: 'yt-vid-999',
          channel: 'youtube',
          eventType: 'engagement',
          count: 5000,
          rawData: expect.objectContaining({
            views: 5000,
            likes: 350,
            comments: 45,
            source: 'youtube-webhook',
          }),
        }),
      );
    });
  });

  describe('tiktok-notification webhook', () => {
    it('updates publishing_results and records engagement performance event', async () => {
      mocks.mockDbMaybeSingle.mockResolvedValueOnce({
        data: { id: 202, tenant_id: 'tenant-tt-1', metrics_json: null },
      });

      const body = JSON.stringify({
        event: 'video.publish.complete',
        data: {
          publish_id: 'tt-pub-888',
          status: 'SUCCESS',
          statistics: {
            play_count: 8200,
            like_count: 610,
            comment_count: 85,
            share_count: 42,
          },
        },
      });

      const req = new Request('https://sophia.agencyos.network/api/webhooks/tiktok-notification', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await tiktokNotificationPOST(req);
      const json = await res.json();
      expect(json).toEqual({ ok: true });

      // publishing_results update verified
      expect(mocks.mockDbUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics_json: expect.stringContaining('"views":8200'),
        }),
      );

      // performance_events record verified
      expect(mocks.mockRecordPerformanceEventIdempotent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'tenant-tt-1',
          assetId: 'tt-pub-888',
          channel: 'tiktok',
          eventType: 'engagement',
          count: 8200,
          rawData: expect.objectContaining({
            views: 8200,
            likes: 610,
            comments: 85,
            shares: 42,
            source: 'tiktok-webhook',
          }),
        }),
      );
    });
  });

  describe('tiktok-shop webhook', () => {
    it('inserts into conversion_events and writes conversion revenue event', async () => {
      process.env.TIKTOK_SHOP_WEBHOOK_SECRET = 'test-secret';
      const orderPayload = JSON.stringify({
        order_id: 'ord-12345',
        settlement_amount: 150.0,
        commission_amount: 22.5,
        sub_id: 'sub-link-1',
      });

      // Mock D1 queries
      mocks.mockD1Prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, tenant_id FROM affiliate_links')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ id: 'link-1', tenant_id: 'tenant-shop-1' }),
            }),
          };
        }
        if (sql.includes('INSERT OR IGNORE INTO conversion_events')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ meta: { rows_written: 1 } }),
            }),
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          }),
        };
      });

      // Generate valid HMAC signature for mock secret
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode('test-secret'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(orderPayload));
      const sigHex = Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const req = new Request('https://sophia.agencyos.network/api/webhooks/tiktok-shop', {
        method: 'POST',
        body: orderPayload,
        headers: {
          'Content-Type': 'application/json',
          'x-tts-signature': sigHex,
        },
      });

      const res = await tiktokShopPOST(req as any);
      const json = await res.json();
      expect(json).toEqual({ ok: true });

      // writeConversionRevenueEvent verified
      expect(mocks.mockWriteConversionRevenueEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          conversionEventId: 'ord-12345',
          tenantId: 'tenant-shop-1',
          grossAmountUsd: 150.0,
          commissionUsd: 22.5,
          offerId: 'link-1',
        }),
      );
    });
  });
});
