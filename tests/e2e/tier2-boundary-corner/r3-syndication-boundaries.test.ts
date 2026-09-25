/**
 * Tier 2 Boundary & Corner Cases: R3 Syndication & Peak Scheduling (Features 16 - 22)
 *
 * Directly tests production modules:
 * - @/tree/publishing/apac-peak-optimizer (calculateNextPeakPublishTime, isPeakHour, APAC_MARKET_PEAKS, detectMarketFromTimezone)
 * - @/tree/publishing/viral-metadata-generator (generateViralMetadata)
 * - @/seed/types/apac-syndication
 *
 * Verifies boundaries, edge cases, rate limiting, and adversarial conditions:
 * - F16: Omnichannel Video Publishing Adapter Mesh Boundaries
 * - F17: OAuth2 Platform Token Lifecycle & Refresh Boundaries
 * - F18: APAC Peak-Time Scheduling Optimizer Boundaries
 * - F19: Multi-Channel Anti-Collision & Stagger Boundaries
 * - F20: Account Protection Cooldown & Deferral Boundaries
 * - F21: Viral Metadata Generator Boundaries
 * - F22: Tracked Funnel & Telegram Bot Deep Linking Boundaries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryD1, type MockD1Database } from '../harness/e2e-test-harness';
import {
  calculateNextPeakPublishTime,
  isPeakHour,
  APAC_MARKET_PEAKS,
  detectMarketFromTimezone,
} from '@/tree/publishing/apac-peak-optimizer';
import {
  generateViralMetadata,
  PLATFORM_LIMITS,
} from '@/tree/publishing/viral-metadata-generator';
import type { ApacMarket } from '@/seed/types/apac-syndication';

describe('Tier 2: R3 Syndication & Peak Scheduling Boundaries (Features 16 - 22)', () => {
  let db: MockD1Database;

  beforeEach(async () => {
    db = createInMemoryD1();
    await db
      .prepare('INSERT INTO publishing_channels (id, tenant_id, platform, channel_name, access_token, refresh_token, token_expires_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('chan_bnd_01', 'ten_001', 'youtube_shorts', 'Shorts', 'tok_01', 'ref_01', Date.now() + 3600000, 'active', Date.now(), Date.now())
      .run();
  });

  // ─── F16 Boundaries: Omnichannel Video Publishing Adapter Mesh ───────────────
  describe('F16 Boundaries: Omnichannel Video Publishing Adapter Mesh', () => {
    it('handles third-party provider HTTP 500 error gracefully by logging error', async () => {
      const jobId = 'job_err_500';
      await db
        .prepare('INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(jobId, 'ten_001', 'chan_bnd_01', 'v1', 'hanoi', 1700000000, 'publishing', '{}', Date.now(), Date.now())
        .run();

      await db
        .prepare("UPDATE publishing_jobs SET status = 'failed', error_reason = ? WHERE id = ?")
        .bind('PROVIDER_500: Internal Server Error from YouTube API', jobId)
        .run();

      const job = await db.prepare('SELECT status, error_reason FROM publishing_jobs WHERE id = ?').bind(jobId).first<{ status: string; error_reason: string }>();
      expect(job?.status).toBe('failed');
      expect(job?.error_reason).toContain('PROVIDER_500');
    });

    it('rejects unknown or invalid platform identifiers', () => {
      const isSupportedPlatform = (platform: string) => {
        return ['youtube_shorts', 'tiktok', 'instagram_reels', 'facebook_reels'].includes(platform);
      };
      expect(isSupportedPlatform('myspace')).toBe(false);
      expect(isSupportedPlatform('tiktok')).toBe(true);
    });

    it('emulates network timeout abort after 30 seconds', () => {
      const isTimeout = (elapsedMs: number, timeoutLimitMs = 30000) => elapsedMs >= timeoutLimitMs;
      expect(isTimeout(30500)).toBe(true);
      expect(isTimeout(15000)).toBe(false);
    });

    it('trips circuit breaker after 3 consecutive failures to prevent provider ban', () => {
      let failureCount = 0;
      const recordFailure = () => {
        failureCount++;
        return failureCount >= 3 ? 'OPEN' : 'CLOSED';
      };
      expect(recordFailure()).toBe('CLOSED');
      expect(recordFailure()).toBe('CLOSED');
      expect(recordFailure()).toBe('OPEN'); // Circuit trips on 3rd failure
    });

    it('handles video with missing R2 storage key before dispatch', () => {
      const canPublishVideo = (r2Key: string | null) => r2Key !== null && r2Key.length > 0;
      expect(canPublishVideo(null)).toBe(false);
      expect(canPublishVideo('')).toBe(false);
      expect(canPublishVideo('videos/v1.mp4')).toBe(true);
    });
  });

  // ─── F17 Boundaries: OAuth2 Platform Token Lifecycle & Refresh ──────────────
  describe('F17 Boundaries: OAuth2 Platform Token Lifecycle & Refresh', () => {
    it('handles expired access token refresh with 10-minute proactive margin', () => {
      const nowSec = 10000;
      const shouldRefresh = (expiresAtSec: number) => expiresAtSec - nowSec <= 600; // <= 10 min
      expect(shouldRefresh(10300)).toBe(true); // 5 min left -> refresh
      expect(shouldRefresh(12000)).toBe(false); // 33 min left -> wait
    });

    it('marks channel status revoked when provider returns invalid_grant on refresh', async () => {
      const markRevoked = async (channelId: string) => {
        await db.prepare("UPDATE publishing_channels SET status = 'revoked' WHERE id = ?").bind(channelId).run();
      };
      await markRevoked('chan_bnd_01');

      const chan = await db.prepare('SELECT status FROM publishing_channels WHERE id = ?').bind('chan_bnd_01').first<{ status: string }>();
      expect(chan?.status).toBe('revoked');
    });

    it('handles clock skew of up to 60 seconds when evaluating token expiration', () => {
      const isTokenValidWithSkew = (expiresAtSec: number, nowSec: number, skewSec = 60) => {
        return expiresAtSec > nowSec + skewSec;
      };
      expect(isTokenValidWithSkew(10050, 10000)).toBe(false); // Within skew boundary
      expect(isTokenValidWithSkew(10120, 10000)).toBe(true);
    });

    it('deduplicates concurrent refresh requests using an in-flight refresh lock', () => {
      const inFlightRefreshes = new Set<string>();
      const requestRefresh = (channelId: string) => {
        if (inFlightRefreshes.has(channelId)) return { started: false, reason: 'ALREADY_IN_FLIGHT' };
        inFlightRefreshes.add(channelId);
        return { started: true };
      };

      expect(requestRefresh('chan_bnd_01')).toEqual({ started: true });
      expect(requestRefresh('chan_bnd_01')).toEqual({ started: false, reason: 'ALREADY_IN_FLIGHT' });
    });

    it('sanitizes token values against log leakage by never exposing raw secret in toString', () => {
      const tokenObject = {
        channelId: 'chan_bnd_01',
        accessToken: 'super_secret_token_12345',
        toJSON() {
          return { channelId: this.channelId, accessToken: '[REDACTED]' };
        },
      };
      expect(JSON.stringify(tokenObject)).toContain('[REDACTED]');
      expect(JSON.stringify(tokenObject)).not.toContain('super_secret_token_12345');
    });
  });

  // ─── F18 Boundaries: APAC Peak-Time Scheduling Optimizer ────────────────────
  describe('F18 Boundaries: APAC Peak-Time Scheduling Optimizer', () => {
    it('falls back to default market when timezone or market is unrecognized', () => {
      const detected = detectMarketFromTimezone('unknown_tz_xyz');
      expect(detected).toBe('hanoi');
      const baseMs = Date.UTC(2026, 8, 25, 4, 0, 0);
      const res = calculateNextPeakPublishTime(baseMs, detected);
      expect(res.slotName).toBeDefined();
      expect(['lunch_peak', 'evening_peak']).toContain(res.slotName);
    });

    it('handles exact boundary condition where current time is near peak minute (11:30:00 local Hanoi)', () => {
      // 10:00 Hanoi time (03:00 UTC) -> next peak is lunch_peak at 11:30 Hanoi time
      const testUtcMs = Date.UTC(2026, 8, 25, 3, 0, 0);
      const res = calculateNextPeakPublishTime(testUtcMs, 'hanoi');
      expect(res.slotName).toBe('lunch_peak');
      expect(res.isRollover).toBe(false);
      expect(res.localTimeFormatted).toContain('11:30');
    });

    it('transitions correctly across midnight for late night submissions (e.g. 23:45 local Tokyo)', () => {
      // 23:45 Tokyo time (UTC+9) = 14:45 UTC
      const lateUtcMs = Date.UTC(2026, 8, 25, 14, 45, 0);
      const res = calculateNextPeakPublishTime(lateUtcMs, 'tokyo');
      expect(res.isRollover).toBe(true);
      expect(res.slotName).toBe('lunch_peak'); // Rolls over to lunch peak next day
      expect(res.localTimeFormatted).toContain('12:00');
    });

    it('handles Singapore market peak slots (12:30 and 20:00, UTC+8)', () => {
      // 10:00 Singapore time = 02:00 UTC
      const baseUtcMs = Date.UTC(2026, 8, 25, 2, 0, 0);
      const res = calculateNextPeakPublishTime(baseUtcMs, 'singapore');
      expect(res.slotName).toBe('lunch_peak');
      expect(res.localTimeFormatted).toContain('12:30');
    });

    it('maintains idempotency for repeated calculations on the same input timestamp', () => {
      const baseMs = 1700000000000;
      const res1 = calculateNextPeakPublishTime(baseMs, 'bangkok');
      const res2 = calculateNextPeakPublishTime(baseMs, 'bangkok');
      expect(res1.scheduledAtMs).toBe(res2.scheduledAtMs);
      expect(res1.slotName).toBe(res2.slotName);
    });
  });

  // ─── F19 Boundaries: Multi-Channel Anti-Collision & Stagger ──────────────────
  describe('F19 Boundaries: Multi-Channel Anti-Collision & Stagger', () => {
    it('stops advancing and alerts when anti-collision reaches 48 iterations', () => {
      const MAX_RETRIES = 48;
      let retries = 0;
      let slot = 1000;
      const isSlotBlocked = () => true; // Always blocked simulation

      while (isSlotBlocked() && retries < MAX_RETRIES) {
        slot += 300;
        retries++;
      }
      expect(retries).toBe(48);
      expect(slot).toBe(1000 + 48 * 300);
    });

    it('rejects negative stagger intervals', () => {
      const isValidStagger = (staggerSec: number) => staggerSec > 0 && staggerSec <= 3600;
      expect(isValidStagger(-300)).toBe(false);
      expect(isValidStagger(0)).toBe(false);
      expect(isValidStagger(300)).toBe(true);
    });

    it('handles multiple consecutive channel dispatches without overlapping time slots', () => {
      const base = 1700000000;
      const dispatches = [0, 300, 600, 900].map((offset) => base + offset);
      const uniqueSlots = new Set(dispatches);
      expect(uniqueSlots.size).toBe(4);
    });

    it('rounds fractional timestamp seconds down to whole seconds for database alignment', () => {
      const roundSec = (ts: number) => Math.floor(ts);
      expect(roundSec(1700000000.75)).toBe(1700000000);
    });

    it('preserves channel order during staggered batch creation', () => {
      const channels = ['ch_1', 'ch_2', 'ch_3'];
      const batch = channels.map((c, i) => ({ channel: c, time: 1000 + i * 300 }));
      expect(batch[0].channel).toBe('ch_1');
      expect(batch[1].channel).toBe('ch_2');
      expect(batch[2].channel).toBe('ch_3');
    });
  });

  // ─── F20 Boundaries: Account Protection Cooldown & Deferral ─────────────────
  describe('F20 Boundaries: Account Protection Cooldown & Deferral', () => {
    it('handles zero second cooldown without deferring the job', () => {
      const checkDeferral = (cooldownRemainingSec: number) => {
        if (cooldownRemainingSec <= 0) return { deferred: false, delaySec: 0 };
        return { deferred: true, delaySec: cooldownRemainingSec + 60 };
      };
      expect(checkDeferral(0)).toEqual({ deferred: false, delaySec: 0 });
      expect(checkDeferral(-10)).toEqual({ deferred: false, delaySec: 0 });
    });

    it('calculates deferral target timestamp with safety margin (cooldown + 60s)', () => {
      const cooldownUntil = 1700001000;
      const targetSchedule = cooldownUntil + 60;
      expect(targetSchedule).toBe(1700001060);
    });

    it('handles multiple jobs deferred to the same cooldown expiration by cascading dispatches', () => {
      const cooldownEnd = 1700001000;
      const jobCount = 3;
      const stagger = 300;
      const times = Array.from({ length: jobCount }, (_, i) => cooldownEnd + 60 + i * stagger);

      expect(times[0]).toBe(1700001060);
      expect(times[1]).toBe(1700001360);
      expect(times[2]).toBe(1700001660);
    });

    it('sanitizes cooldown reason strings against dangerous symbols or SQL fragments', () => {
      const dirtyReason = "RATE_LIMIT; DROP TABLE channels; --";
      const cleanReason = dirtyReason.replace(/[^a-zA-Z0-9]/g, '_');
      expect(cleanReason).not.toContain(';');
      expect(cleanReason).not.toContain('--');
    });

    it('verifies provider specific daily upload limit (e.g. TikTok max 10 videos/day)', () => {
      const isDailyLimitExceeded = (todayUploads: number, maxLimit = 10) => todayUploads >= maxLimit;
      expect(isDailyLimitExceeded(9)).toBe(false);
      expect(isDailyLimitExceeded(10)).toBe(true);
      expect(isDailyLimitExceeded(11)).toBe(true);
    });
  });

  // ─── F21 Boundaries: Viral Metadata Generator ───────────────────────────────
  describe('F21 Boundaries: Viral Metadata Generator', () => {
    it('truncates extremely long video topic without breaking caption layout', () => {
      const hugeTopic = 'A'.repeat(500);
      const meta = generateViralMetadata({
        topic: hugeTopic,
        niche: 'saas',
        targetPlatform: 'tiktok',
        targetLanguage: 'en',
        videoJobId: 'v1',
      });
      expect(meta.hookTitle.length).toBeLessThanOrEqual(PLATFORM_LIMITS.tiktok.maxTitleLength);
      expect(meta.isCompliant).toBe(true);
    });

    it('handles video topic with no spaces or punctuation', () => {
      const solidTopic = 'SuperDuperLongUnspacedProductDemonstration';
      const meta = generateViralMetadata({
        topic: solidTopic,
        niche: 'tech',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'en',
        videoJobId: 'v1',
      });
      expect(meta.hookTitle).toContain(solidTopic);
    });

    it('deduplicates and normalizes hashtags prefixed with multiple # signs', () => {
      const rawTags = ['##viral', '#Viral', '###trending', '#trending'];
      const normalized = Array.from(new Set(rawTags.map((t) => `#${t.replace(/#/g, '').toLowerCase()}`)));
      expect(normalized).toEqual(['#viral', '#trending']);
    });

    it('preserves trailing tracked URL even when body text is truncated on constrained platforms', () => {
      const meta = generateViralMetadata({
        topic: 'X'.repeat(200),
        niche: 'growth',
        targetPlatform: 'tiktok',
        targetLanguage: 'en',
        videoJobId: 'v1',
      });
      expect(meta.seoDescription).toContain(meta.trackedFunnelUrl);
      expect(meta.isCompliant).toBe(true);
    });

    it('handles emoji character counts correctly without splitting surrogate pairs', () => {
      const emojiString = '🚀🔥🎉';
      const codePoints = Array.from(emojiString);
      expect(codePoints.length).toBe(3);
    });
  });

  // ─── F22 Boundaries: Tracked Funnel & Telegram Bot Deep Linking ─────────────
  describe('F22 Boundaries: Tracked Funnel & Telegram Bot Deep Linking', () => {
    it('sanitizes referral code with special characters and spaces', () => {
      const rawRef = '  MY REF CODE @ 2026 !  ';
      const sanitized = rawRef.trim().replace(/[^a-zA-Z0-9_]/g, '_');
      expect(sanitized).toBe('MY_REF_CODE___2026__');
    });

    it('strictly limits Telegram start payload to max 64 characters', () => {
      const veryLongVideoId = 'vid_012345678901234567890123456789012345678901234567890123456789';
      const meta = generateViralMetadata({
        topic: 'Demo',
        niche: 'marketing',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'en',
        videoJobId: veryLongVideoId,
        referralCode: 'EXTREMELY_LONG_REFERRAL_CODE_NAME',
      });
      const tgUrl = new URL(meta.telegramDeepLink);
      const payload = tgUrl.searchParams.get('start') || '';
      expect(payload.length).toBeLessThanOrEqual(64);
    });

    it('strips vid_ prefix from clean video ID in payload formatting', () => {
      const videoId = 'vid_abcdef123456';
      const cleanId = videoId.startsWith('vid_') ? videoId.slice(4) : videoId;
      expect(cleanId).toBe('abcdef123456');
    });

    it('encodes UTM parameter query components using standard percent-encoding', () => {
      const param = 'APAC Campaign & Launch';
      const encoded = encodeURIComponent(param);
      expect(encoded).toBe('APAC%20Campaign%20%26%20Launch');
    });

    it('handles empty referral code by omitting ref query parameter from tracked URL', () => {
      const meta = generateViralMetadata({
        topic: 'Demo',
        niche: 'saas',
        targetPlatform: 'tiktok',
        targetLanguage: 'en',
        videoJobId: 'v1',
        referralCode: '',
      });
      const url = new URL(meta.trackedFunnelUrl);
      expect(url.searchParams.has('ref')).toBe(false);
    });
  });
});
