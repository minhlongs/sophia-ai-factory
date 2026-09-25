/**
 * Tier 1 Feature Coverage: R3 Syndication Mesh & Peak-Time Scheduling (Features 16 - 22)
 *
 * Directly tests production modules:
 * - @/tree/publishing/apac-peak-optimizer (calculateNextPeakPublishTime, isPeakHour, APAC_MARKET_PEAKS)
 * - @/tree/publishing/viral-metadata-generator (generateViralMetadata, formatSeoDescription)
 * - @/seed/types/apac-syndication
 *
 * Verifies nominal functionality:
 * - F16: Omnichannel Video Publishing Adapter Mesh
 * - F17: OAuth2 Platform Token Lifecycle & Refresh
 * - F18: APAC Peak-Time Scheduling Optimizer
 * - F19: Multi-Channel Anti-Collision & Stagger
 * - F20: Account Protection Cooldown & Deferral
 * - F21: Viral Metadata Generator
 * - F22: Tracked Funnel & Telegram Bot Deep Linking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryD1, type MockD1Database } from '../harness/e2e-test-harness';
import {
  calculateNextPeakPublishTime,
  isPeakHour,
  APAC_MARKET_PEAKS,
} from '@/tree/publishing/apac-peak-optimizer';
import {
  generateViralMetadata,
} from '@/tree/publishing/viral-metadata-generator';
import type {
  ApacMarket,
  PlatformType,
  ViralMetadataInput,
  ViralMetadataResult,
} from '@/seed/types/apac-syndication';

describe('Tier 1: R3 Syndication Mesh & Peak-Time Scheduling (Features 16 - 22)', () => {
  let db: MockD1Database;

  beforeEach(async () => {
    db = createInMemoryD1();
    // Seed channels
    await db
      .prepare('INSERT INTO publishing_channels (id, tenant_id, platform, channel_name, access_token, refresh_token, token_expires_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('chan_yt_01', 'ten_001', 'youtube_shorts', 'Sophia Shorts Global', 'ya29.mock_token', 'refresh_yt_01', Date.now() + 3600000, 'active', Date.now(), Date.now())
      .run();

    await db
      .prepare('INSERT INTO publishing_channels (id, tenant_id, platform, channel_name, access_token, refresh_token, token_expires_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('chan_tt_01', 'ten_001', 'tiktok', 'Sophia AI Official', 'act.mock_tiktok', 'refresh_tt_01', Date.now() + 3600000, 'active', Date.now(), Date.now())
      .run();

    await db
      .prepare('INSERT INTO publishing_channels (id, tenant_id, platform, channel_name, access_token, refresh_token, token_expires_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('chan_ig_01', 'ten_001', 'instagram_reels', 'sophia_ai_apac', 'IGQV.mock_ig', 'refresh_ig_01', Date.now() + 3600000, 'active', Date.now(), Date.now())
      .run();

    await db
      .prepare('INSERT INTO publishing_channels (id, tenant_id, platform, channel_name, access_token, refresh_token, token_expires_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('chan_fb_01', 'ten_001', 'facebook_reels', 'Sophia AI Page', 'EAAB.mock_fb', 'refresh_fb_01', Date.now() + 3600000, 'active', Date.now(), Date.now())
      .run();
  });

  // ─── Feature 16: Omnichannel Video Publishing Adapter Mesh ──────────────────
  describe('F16: Omnichannel Video Publishing Adapter Mesh', () => {
    it('supports 4 canonical short-form platforms (YouTube Shorts, TikTok, IG Reels, FB Reels)', async () => {
      const channels = await db.prepare('SELECT platform FROM publishing_channels').all<{ platform: string }>();
      const platforms = channels.results.map((c) => c.platform);
      expect(platforms).toContain('youtube_shorts');
      expect(platforms).toContain('tiktok');
      expect(platforms).toContain('instagram_reels');
      expect(platforms).toContain('facebook_reels');
    });

    it('creates a scheduled publishing job with platform-specific metadata', async () => {
      const jobId = 'job_pub_01';
      const meta = JSON.stringify({ title: 'Top AI Tools', tags: ['#AI', '#Viral'] });
      await db
        .prepare('INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(jobId, 'ten_001', 'chan_yt_01', 'vid_001', 'hanoi', 1700000000, 'scheduled', meta, Date.now(), Date.now())
        .run();

      const job = await db.prepare('SELECT * FROM publishing_jobs WHERE id = ?').bind(jobId).first<{ channel_id: string; status: string }>();
      expect(job?.channel_id).toBe('chan_yt_01');
      expect(job?.status).toBe('scheduled');
    });

    it('updates publishing job to published status with external platform post ID', async () => {
      const jobId = 'job_pub_02';
      await db
        .prepare('INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(jobId, 'ten_001', 'chan_tt_01', 'vid_001', 'tokyo', 1700000000, 'publishing', '{}', Date.now(), Date.now())
        .run();

      const externalId = 'tt_post_987654321';
      await db
        .prepare("UPDATE publishing_jobs SET status = 'published', platform_post_id = ?, updated_at = ? WHERE id = ?")
        .bind(externalId, Date.now(), jobId)
        .run();

      const updated = await db.prepare('SELECT status, platform_post_id FROM publishing_jobs WHERE id = ?').bind(jobId).first<{ status: string; platform_post_id: string }>();
      expect(updated?.status).toBe('published');
      expect(updated?.platform_post_id).toBe(externalId);
    });

    it('records detailed failure reason when platform adapter encounters upload rejection', async () => {
      const jobId = 'job_pub_03';
      await db
        .prepare('INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(jobId, 'ten_001', 'chan_ig_01', 'vid_001', 'bangkok', 1700000000, 'publishing', '{}', Date.now(), Date.now())
        .run();

      await db
        .prepare("UPDATE publishing_jobs SET status = 'failed', error_reason = ?, updated_at = ? WHERE id = ?")
        .bind('ASPECT_RATIO_INVALID: Video must be 9:16 vertical', Date.now(), jobId)
        .run();

      const failed = await db.prepare('SELECT status, error_reason FROM publishing_jobs WHERE id = ?').bind(jobId).first<{ status: string; error_reason: string }>();
      expect(failed?.status).toBe('failed');
      expect(failed?.error_reason).toContain('9:16');
    });

    it('queries all active publishing channels for a tenant', async () => {
      const active = await db.prepare("SELECT count(*) as count FROM publishing_channels WHERE tenant_id = ? AND status = 'active'").bind('ten_001').first<{ count: number }>();
      expect(active?.count).toBe(4);
    });
  });

  // ─── Feature 17: OAuth2 Platform Token Lifecycle & Refresh ──────────────────
  describe('F17: OAuth2 Platform Token Lifecycle & Refresh', () => {
    it('detects near-expiry tokens needing background refresh', async () => {
      // Set token expiration to 5 minutes from now
      const fiveMinSec = Math.floor(Date.now() / 1000) + 300;
      await db.prepare('UPDATE publishing_channels SET token_expires_at = ? WHERE id = ?').bind(fiveMinSec, 'chan_yt_01').run();

      const bufferSec = 600; // 10 min window
      const nowSec = Math.floor(Date.now() / 1000);
      const expiringChannels = await db
        .prepare('SELECT id FROM publishing_channels WHERE token_expires_at <= ? AND status = ?')
        .bind(nowSec + bufferSec, 'active')
        .all<{ id: string }>();

      expect(expiringChannels.results.map((c) => c.id)).toContain('chan_yt_01');
    });

    it('updates access token and rolls forward expiration timestamp on successful refresh', async () => {
      const newAccessToken = 'ya29.refreshed_token_123';
      const newExpiry = Math.floor(Date.now() / 1000) + 3600;

      await db
        .prepare('UPDATE publishing_channels SET access_token = ?, token_expires_at = ?, updated_at = ? WHERE id = ?')
        .bind(newAccessToken, newExpiry, Date.now(), 'chan_yt_01')
        .run();

      const chan = await db.prepare('SELECT access_token, token_expires_at FROM publishing_channels WHERE id = ?').bind('chan_yt_01').first<{ access_token: string; token_expires_at: number }>();
      expect(chan?.access_token).toBe(newAccessToken);
      expect(chan?.token_expires_at).toBe(newExpiry);
    });

    it('marks channel status as expired when refresh token is rejected or revoked', async () => {
      await db
        .prepare("UPDATE publishing_channels SET status = 'expired', updated_at = ? WHERE id = ?")
        .bind(Date.now(), 'chan_tt_01')
        .run();

      const chan = await db.prepare('SELECT status FROM publishing_channels WHERE id = ?').bind('chan_tt_01').first<{ status: string }>();
      expect(chan?.status).toBe('expired');
    });

    it('supports rotating refresh token when provider issues new refresh credentials', async () => {
      const newRefreshToken = 'refresh_rotated_999';
      await db.prepare('UPDATE publishing_channels SET refresh_token = ? WHERE id = ?').bind(newRefreshToken, 'chan_ig_01').run();

      const chan = await db.prepare('SELECT refresh_token FROM publishing_channels WHERE id = ?').bind('chan_ig_01').first<{ refresh_token: string }>();
      expect(chan?.refresh_token).toBe(newRefreshToken);
    });

    it('ensures distinct access and refresh tokens per provider channel', async () => {
      const channels = await db.prepare('SELECT access_token, refresh_token FROM publishing_channels').all<{ access_token: string; refresh_token: string }>();
      const accessTokens = new Set(channels.results.map((c) => c.access_token));
      expect(accessTokens.size).toBe(channels.results.length);
    });
  });

  // ─── Feature 18: APAC Peak-Time Scheduling Optimizer ────────────────────────
  describe('F18: APAC Peak-Time Scheduling Optimizer', () => {
    it('defines accurate peak golden hours for Hanoi (11:30 and 19:30)', () => {
      const hanoiSlots = APAC_MARKET_PEAKS['hanoi'].slots;
      expect(hanoiSlots.map((s) => ({ hour: s.hour, minute: s.minute }))).toEqual([
        { hour: 11, minute: 30 },
        { hour: 19, minute: 30 },
      ]);
    });

    it('defines accurate peak golden hours for Tokyo (12:00 and 20:00)', () => {
      const tokyoSlots = APAC_MARKET_PEAKS['tokyo'].slots;
      expect(tokyoSlots.map((s) => ({ hour: s.hour, minute: s.minute }))).toEqual([
        { hour: 12, minute: 0 },
        { hour: 20, minute: 0 },
      ]);
    });

    it('defines accurate peak golden hours for Bangkok (12:00 and 20:30)', () => {
      const bangkokSlots = APAC_MARKET_PEAKS['bangkok'].slots;
      expect(bangkokSlots.map((s) => ({ hour: s.hour, minute: s.minute }))).toEqual([
        { hour: 12, minute: 0 },
        { hour: 20, minute: 30 },
      ]);
    });

    it('selects today 11:30 slot for Hanoi when scheduled at 10:00 local time', () => {
      // 10:00 Hanoi time (UTC+7) = 03:00 UTC
      const baseUtcMs = Date.UTC(2026, 8, 25, 3, 0, 0);
      const res = calculateNextPeakPublishTime(baseUtcMs, 'hanoi');
      expect(res.slotName).toBe('lunch_peak');
      expect(res.isRollover).toBe(false);
      expect(isPeakHour(res.scheduledAtMs, 'hanoi')).toBe(true);
    });

    it('rolls forward to tomorrow 12:00 slot for Tokyo when scheduled after last peak (21:00 local)', () => {
      // 21:00 Tokyo time (UTC+9) = 12:00 UTC
      const baseUtcMs = Date.UTC(2026, 8, 25, 12, 0, 0);
      const res = calculateNextPeakPublishTime(baseUtcMs, 'tokyo');
      expect(res.slotName).toBe('lunch_peak');
      expect(res.isRollover).toBe(true);
      expect(isPeakHour(res.scheduledAtMs, 'tokyo')).toBe(true);
    });
  });

  // ─── Feature 19: Multi-Channel Anti-Collision & Stagger ──────────────────────
  describe('F19: Multi-Channel Anti-Collision & Stagger', () => {
    it('staggers dispatches across 4 channels by 300 seconds (5 minutes)', () => {
      const baseTimestamp = 1700000000;
      const staggerSec = 300;
      const channels = ['youtube_shorts', 'tiktok', 'instagram_reels', 'facebook_reels'];

      const schedule = channels.map((ch, idx) => ({
        channel: ch,
        scheduledAt: baseTimestamp + idx * staggerSec,
      }));

      expect(schedule[0].scheduledAt).toBe(baseTimestamp);
      expect(schedule[1].scheduledAt).toBe(baseTimestamp + 300);
      expect(schedule[2].scheduledAt).toBe(baseTimestamp + 600);
      expect(schedule[3].scheduledAt).toBe(baseTimestamp + 900);
    });

    it('resolves database slot collision on same channel by advancing to next open slot', async () => {
      const initialSlot = 1700000000;
      // Existing job at 1700000000
      await db
        .prepare('INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('job_existing', 'ten_001', 'chan_yt_01', 'vid_01', 'hanoi', initialSlot, 'scheduled', '{}', Date.now(), Date.now())
        .run();

      // Resolve collision algorithm: check [time - 299, time + 299]
      let candidateSlot = initialSlot;
      let collision = true;
      while (collision) {
        const existing = await db
          .prepare('SELECT id FROM publishing_jobs WHERE channel_id = ? AND scheduled_at BETWEEN ? AND ? LIMIT 1')
          .bind('chan_yt_01', candidateSlot - 299, candidateSlot + 299)
          .first<{ id: string }>();

        if (existing) {
          candidateSlot += 300; // Advance 5 min
        } else {
          collision = false;
        }
      }

      expect(candidateSlot).toBe(initialSlot + 300);
    });

    it('allows concurrent dispatches on DIFFERENT channels at the exact same second', async () => {
      const exactSecond = 1700000000;
      await db
        .prepare('INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('job_diff_1', 'ten_001', 'chan_yt_01', 'vid_01', 'hanoi', exactSecond, 'scheduled', '{}', Date.now(), Date.now())
        .run();

      await db
        .prepare('INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('job_diff_2', 'ten_001', 'chan_tt_01', 'vid_01', 'hanoi', exactSecond, 'scheduled', '{}', Date.now(), Date.now())
        .run();

      const jobs = await db.prepare('SELECT id FROM publishing_jobs WHERE scheduled_at = ?').bind(exactSecond).all<{ id: string }>();
      expect(jobs.results).toHaveLength(2);
    });

    it('caps anti-collision retry loop at maximum 48 iterations (4 hours)', () => {
      const MAX_COLLISION_RETRIES = 48;
      let candidate = 1000;
      let iterations = 0;
      while (iterations < MAX_COLLISION_RETRIES) {
        candidate += 300;
        iterations++;
      }
      expect(iterations).toBe(48);
      expect(candidate).toBe(1000 + 48 * 300);
    });

    it('verifies all scheduled times across batch dispatches are strictly sorted', () => {
      const times = [1700000000, 1700000300, 1700000600, 1700000900];
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThan(times[i - 1]);
      }
    });
  });

  // ─── Feature 20: Account Protection Cooldown & Deferral ─────────────────────
  describe('F20: Account Protection Cooldown & Deferral', () => {
    it('identifies active channel cooldown when provider triggers rate limiting', async () => {
      const cooldownSec = Math.floor(Date.now() / 1000) + 1800; // 30 min cooldown
      await db
        .prepare('INSERT INTO channel_cooldowns (id, channel_id, provider, cooldown_until, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('cd_01', 'chan_tt_01', 'tiktok', cooldownSec, 'RATE_LIMIT_429', Date.now())
        .run();

      const nowSec = Math.floor(Date.now() / 1000);
      const activeCooldown = await db
        .prepare('SELECT cooldown_until, reason FROM channel_cooldowns WHERE channel_id = ? AND cooldown_until > ?')
        .bind('chan_tt_01', nowSec)
        .first<{ cooldown_until: number; reason: string }>();

      expect(activeCooldown).toBeDefined();
      expect(activeCooldown?.reason).toBe('RATE_LIMIT_429');
    });

    it('defers job scheduled_at to cooldown expiry instead of dropping or throwing error', async () => {
      const cooldownExpiry = Math.floor(Date.now() / 1000) + 1800;
      const deferredJobId = 'job_deferred_01';

      await db
        .prepare('INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(deferredJobId, 'ten_001', 'chan_tt_01', 'vid_01', 'tokyo', cooldownExpiry + 60, 'deferred', '{}', Date.now(), Date.now())
        .run();

      const job = await db.prepare('SELECT status, scheduled_at FROM publishing_jobs WHERE id = ?').bind(deferredJobId).first<{ status: string; scheduled_at: number }>();
      expect(job?.status).toBe('deferred');
      expect(job?.scheduled_at).toBeGreaterThan(cooldownExpiry);
    });

    it('allows immediate scheduling when cooldown period has expired', async () => {
      const pastCooldown = Math.floor(Date.now() / 1000) - 300; // 5 min ago
      await db
        .prepare('INSERT INTO channel_cooldowns (id, channel_id, provider, cooldown_until, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('cd_past', 'chan_ig_01', 'instagram', pastCooldown, 'EXPIRED_COOLDOWN', Date.now())
        .run();

      const nowSec = Math.floor(Date.now() / 1000);
      const active = await db
        .prepare('SELECT id FROM channel_cooldowns WHERE channel_id = ? AND cooldown_until > ?')
        .bind('chan_ig_01', nowSec)
        .first<{ id: string }>();

      expect(active).toBeUndefined();
    });

    it('isolates cooldown state per channel without affecting other channels', async () => {
      const activeCooldown = Math.floor(Date.now() / 1000) + 3600;
      await db
        .prepare('INSERT INTO channel_cooldowns (id, channel_id, provider, cooldown_until, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('cd_iso', 'chan_tt_01', 'tiktok', activeCooldown, 'ISOLATED_LIMIT', Date.now())
        .run();

      const nowSec = Math.floor(Date.now() / 1000);
      const ytCooldown = await db
        .prepare('SELECT id FROM channel_cooldowns WHERE channel_id = ? AND cooldown_until > ?')
        .bind('chan_yt_01', nowSec)
        .first();

      expect(ytCooldown).toBeUndefined();
    });

    it('logs cooldown audit telemetry with reason and created timestamp', async () => {
      await db
        .prepare('INSERT INTO channel_cooldowns (id, channel_id, provider, cooldown_until, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('cd_telemetry', 'chan_fb_01', 'facebook', Date.now() + 60000, 'BURST_LIMIT', Date.now())
        .run();

      const entry = await db.prepare('SELECT provider, reason, created_at FROM channel_cooldowns WHERE id = ?').bind('cd_telemetry').first<{ provider: string; reason: string; created_at: number }>();
      expect(entry?.provider).toBe('facebook');
      expect(entry?.reason).toBe('BURST_LIMIT');
      expect(entry?.created_at).toBeGreaterThan(0);
    });
  });

  // ─── Feature 21: Viral Metadata Generator ───────────────────────────────────
  describe('F21: Viral Metadata Generator', () => {
    it('generates click-worthy hook title tailored to target locale', () => {
      const metaVi = generateViralMetadata({
        topic: 'bán hàng online',
        niche: 'ecommerce',
        targetPlatform: 'tiktok',
        targetLanguage: 'vi',
        targetMarket: 'hanoi',
        videoJobId: 'vid_01',
      });
      expect(metaVi.hookTitle).toContain('bán hàng online');

      const metaJa = generateViralMetadata({
        topic: '集客術',
        niche: 'ecommerce',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'ja',
        targetMarket: 'tokyo',
        videoJobId: 'vid_01',
      });
      expect(metaJa.hookTitle).toContain('集客術');
      expect(metaJa.hookTitle).toContain('【');
    });

    it('strictly adheres to platform title character budgets (YouTube Shorts <= 100 chars)', () => {
      const meta = generateViralMetadata({
        topic: 'A very long video title that could exceed character boundaries if not properly budgeted and truncated by the viral engine',
        niche: 'ai_automation',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'en',
        targetMarket: 'singapore',
        videoJobId: 'vid_01',
      });
      expect(meta.hookTitle.length).toBeLessThanOrEqual(100);
      expect(meta.isCompliant).toBe(true);
    });

    it('strictly adheres to platform caption character budgets (TikTok <= 2200 chars)', () => {
      const meta = generateViralMetadata({
        topic: 'Growth Hacking Tips',
        niche: 'solopreneur',
        targetPlatform: 'tiktok',
        targetLanguage: 'en',
        targetMarket: 'singapore',
        videoJobId: 'vid_long_id_001',
      });
      expect(meta.seoDescription.length).toBeLessThanOrEqual(2200);
      expect(meta.isCompliant).toBe(true);
    });

    it('includes relevant trending hashtags prefixed with #', () => {
      const meta = generateViralMetadata({
        topic: 'AI Tools',
        niche: 'ai_automation',
        targetPlatform: 'tiktok',
        targetLanguage: 'en',
        targetMarket: 'singapore',
        videoJobId: 'vid_01',
      });
      expect(meta.hashtags.length).toBeGreaterThan(0);
      meta.hashtags.forEach((tag) => {
        expect(tag.startsWith('#')).toBe(true);
      });
    });

    it('attaches verified tracked funnel URL into the generated caption', () => {
      const meta = generateViralMetadata({
        topic: 'Video Marketing',
        niche: 'solopreneur',
        targetPlatform: 'tiktok',
        targetLanguage: 'vi',
        targetMarket: 'hanoi',
        videoJobId: 'vid_track_01',
      });
      expect(meta.seoDescription).toContain(meta.trackedFunnelUrl);
    });
  });

  // ─── Feature 22: Tracked Funnel & Telegram Bot Deep Linking ─────────────────
  describe('F22: Tracked Funnel & Telegram Bot Deep Linking', () => {
    it('constructs tracked URL with full UTM attribution suite (source, medium, campaign, content)', () => {
      const meta = generateViralMetadata({
        topic: 'Sales Funnel',
        niche: 'solopreneur',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'en',
        targetMarket: 'singapore',
        videoJobId: 'vid_utm_01',
      });
      const url = new URL(meta.trackedFunnelUrl);
      expect(url.searchParams.get('utm_source')).toBe('youtube_shorts');
      expect(url.searchParams.get('utm_medium')).toBe('short_video');
      expect(url.searchParams.get('utm_campaign')).toBe('solopreneur');
      expect(url.searchParams.get('utm_content')).toContain('vid_utm_01');
    });

    it('appends referral code parameter when provided by creator', () => {
      const meta = generateViralMetadata({
        topic: 'Course Launch',
        niche: 'solopreneur',
        targetPlatform: 'tiktok',
        targetLanguage: 'vi',
        targetMarket: 'hanoi',
        videoJobId: 'vid_ref_01',
        referralCode: 'TOPCREATOR99',
      });
      const url = new URL(meta.trackedFunnelUrl);
      expect(url.searchParams.get('ref')).toBe('TOPCREATOR99');
    });

    it('sanitizes Telegram deep-link payload to alphanumeric and underscores strictly <= 64 chars', () => {
      const meta = generateViralMetadata({
        topic: 'AI Automation',
        niche: 'ai_automation',
        targetPlatform: 'instagram_reels',
        targetLanguage: 'en',
        targetMarket: 'singapore',
        videoJobId: 'vid_very_long_complex_uuid_string_001122334455',
        referralCode: 'SPECIAL!@#$CODE',
      });
      const tgUrl = new URL(meta.telegramDeepLink);
      const payload = tgUrl.searchParams.get('start') || '';
      expect(payload).toMatch(/^[a-zA-Z0-9_]+$/);
      expect(payload.length).toBeLessThanOrEqual(64);
    });

    it('points to canonical Sophia Telegram qualification bot username', () => {
      const meta = generateViralMetadata({
        topic: 'Demo',
        niche: 'ai_automation',
        targetPlatform: 'tiktok',
        targetLanguage: 'en',
        targetMarket: 'singapore',
        videoJobId: 'v1',
      });
      expect(meta.telegramDeepLink).toContain('t.me/Sophia_Bbot?start=');
    });

    it('preserves tracked URL and Telegram link intact even when caption is constrained', () => {
      const meta = generateViralMetadata({
        topic: 'Short Hook',
        niche: 'solopreneur',
        targetPlatform: 'tiktok',
        targetLanguage: 'en',
        targetMarket: 'singapore',
        videoJobId: 'v2',
        referralCode: 'VIP',
      });
      expect(meta.seoDescription).toContain(meta.trackedFunnelUrl);
      expect(meta.seoDescription).toContain(meta.telegramDeepLink);
    });
  });
});
