import { describe, it, expect } from 'vitest';
import {
  evaluateChannelPacing,
  calculateOrganicJitter,
  isChannelInCooldown,
  getDailyCap,
  CHANNEL_COOLDOWN_MS,
  BASE_JITTER_MS,
} from '../pacing-engine';

describe('pacing-engine', () => {
  const nowMs = 1760000000000; // Fixed deterministic baseline epoch

  describe('Platform Daily Caps', () => {
    it('enforces platform specific daily upload caps', () => {
      expect(getDailyCap('YOUTUBE_SHORTS')).toBe(6);
      expect(getDailyCap('TIKTOK_V2')).toBe(4);
      expect(getDailyCap('INSTAGRAM_REELS')).toBe(4);
    });

    it('rejects scheduling when daily cap is reached', () => {
      const decision = evaluateChannelPacing({
        platform: 'TIKTOK_V2',
        channelId: 'tt_channel_123',
        todayPublishedCount: 4,
        lastPublishedAtMs: nowMs - 200 * 60 * 1000,
      }, { nowMs });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('DAILY_CAP_EXCEEDED');
      expect(decision.remainingToday).toBe(0);
      expect(decision.delayMs).toBeGreaterThan(0);
      expect(decision.scheduledForMs).toBe(nowMs + decision.delayMs);
    });
  });

  describe('Channel 180-Minute Cooldown', () => {
    it('detects active cooldown on recent post within 180 min', () => {
      const lastPublished = nowMs - 60 * 60 * 1000; // 60 min ago
      expect(isChannelInCooldown(lastPublished, nowMs)).toBe(true);

      const decision = evaluateChannelPacing({
        platform: 'YOUTUBE_SHORTS',
        channelId: 'yt_chan_1',
        todayPublishedCount: 2,
        lastPublishedAtMs: lastPublished,
      }, { nowMs, randomFn: () => 0 }); // 0 jitter variance

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('CHANNEL_COOLDOWN_ACTIVE');
      expect(decision.remainingToday).toBe(4);
      // Cooldown remaining (120 min) + base jitter (45 min) = 165 min
      const expectedRemaining = 120 * 60 * 1000 + BASE_JITTER_MS;
      expect(decision.delayMs).toBe(expectedRemaining);
    });

    it('allows posting when cooldown has expired or no previous post', () => {
      expect(isChannelInCooldown(null, nowMs)).toBe(false);
      const oldPost = nowMs - (CHANNEL_COOLDOWN_MS + 1000);
      expect(isChannelInCooldown(oldPost, nowMs)).toBe(false);
    });
  });

  describe('Organic Jitter Calculations', () => {
    it('calculates deterministic jitter with injected randomFn', () => {
      // 0% variance: exactly base 45 min (2,700,000 ms)
      const minJitter = calculateOrganicJitter({ randomFn: () => 0 });
      expect(minJitter).toBe(45 * 60 * 1000);

      // 100% variance: base 45 min + 45 min = 90 min (5,400,000 ms)
      const maxJitter = calculateOrganicJitter({ randomFn: () => 1 });
      expect(maxJitter).toBe(90 * 60 * 1000);

      // 50% variance: base 45 min + 22.5 min = 67.5 min (4,050,000 ms)
      const midJitter = calculateOrganicJitter({ randomFn: () => 0.5 });
      expect(midJitter).toBe(4050000);
    });
  });

  describe('Full Pacing Evaluation', () => {
    it('grants approval with organic jitter for first post of the day', () => {
      const decision = evaluateChannelPacing({
        platform: 'INSTAGRAM_REELS',
        channelId: 'ig_brand_account',
        todayPublishedCount: 0,
        lastPublishedAtMs: null,
      }, { nowMs, randomFn: () => 0 });

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('OK');
      expect(decision.dailyCap).toBe(4);
      expect(decision.remainingToday).toBe(4);
      expect(decision.jitterMs).toBe(BASE_JITTER_MS);
      expect(decision.delayMs).toBe(BASE_JITTER_MS);
      expect(decision.scheduledForMs).toBe(nowMs + BASE_JITTER_MS);
    });
  });
});
