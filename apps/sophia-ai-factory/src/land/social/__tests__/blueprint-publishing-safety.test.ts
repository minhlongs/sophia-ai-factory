/** @vitest-environment node */

/**
 * Blueprint Direct Social Publishing Safety Suite (Lane 4)
 *
 * Validates Priority Task #2 & Steps 11, 12, 19, 25:
 * 1. Pacing Engine: daily caps (6/4/4), 180-min cooldown, organic jitter 45-90 min, UTC day rollover.
 * 2. OCC Lock: transitionDraftToPending succeeds first time and rejects duplicate transition.
 * 3. Emergency Killswitch: setChannelKillSwitch blocks dispatch with KILL_SWITCH_ACTIVE.
 *
 * Layer: land/social (Complies with seed -> tree -> forest -> land)
 * @module land/social/__tests__/blueprint-publishing-safety.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import {
  evaluateChannelPacing,
  calculateOrganicJitter,
  DAILY_CAPS,
  BASE_JITTER_MS,
} from '@/tree/social/publisher/pacing-engine';
import {
  ensurePublishJobsTable,
  createPublishJob,
  transitionDraftToPending,
} from '@/land/social/publish-job-store';

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

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ['evt_test'] }) },
}));

vi.mock('@/land/social/platform-credentials-store', () => ({
  getCredential: vi.fn(),
  setChannelKillSwitch: vi.fn(),
  upsertCredential: vi.fn(),
  listUserCredentials: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getCredential, setChannelKillSwitch } from '@/land/social/platform-credentials-store';
import {
  dispatchSocialPublishAction,
  triggerEmergencyKillSwitchAction,
} from '@/land/social/actions/social-publisher-actions';

describe('Blueprint Direct Social Publishing Safety Suite (Lane 4)', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let d1: D1Database;
  const epoch = 1760000000000;

  beforeEach(async () => {
    vi.clearAllMocks();
    rawDb = new DatabaseSync(':memory:');
    d1 = makeD1(rawDb) as unknown as D1Database;
    await ensurePublishJobsTable(d1);
  });

  describe('1. Anti-Detection Pacing Engine', () => {
    it('enforces platform daily caps (6/4/4), 180m cooldown, organic jitter (45-90m), and UTC rollover', () => {
      expect(DAILY_CAPS.YOUTUBE_SHORTS).toBe(6);
      expect(DAILY_CAPS.TIKTOK_V2).toBe(4);
      expect(DAILY_CAPS.INSTAGRAM_REELS).toBe(4);

      const jitterMin = calculateOrganicJitter({ randomFn: () => 0 });
      const jitterMax = calculateOrganicJitter({ randomFn: () => 1 });
      expect(jitterMin).toBe(BASE_JITTER_MS);
      expect(jitterMax).toBe(90 * 60 * 1000);

      const decisionCap = evaluateChannelPacing({
        platform: 'TIKTOK_V2',
        channelId: 'ch_tiktok_01',
        todayPublishedCount: 4,
        lastPublishedAtMs: epoch - 200 * 60 * 1000,
      }, { nowMs: epoch });
      expect(decisionCap.allowed).toBe(false);
      expect(decisionCap.reason).toBe('DAILY_CAP_EXCEEDED');

      const decisionCooldown = evaluateChannelPacing({
        platform: 'YOUTUBE_SHORTS',
        channelId: 'ch_yt_01',
        todayPublishedCount: 1,
        lastPublishedAtMs: epoch - 60 * 60 * 1000,
      }, { nowMs: epoch, randomFn: () => 0 });
      expect(decisionCooldown.allowed).toBe(false);
      expect(decisionCooldown.reason).toBe('CHANNEL_COOLDOWN_ACTIVE');
      expect(decisionCooldown.delayMs).toBe(120 * 60 * 1000 + BASE_JITTER_MS);

      const decisionRollover = evaluateChannelPacing({
        platform: 'INSTAGRAM_REELS',
        channelId: 'ch_ig_01',
        todayPublishedCount: 4,
        lastPublishedAtMs: epoch - 25 * 60 * 60 * 1000,
      }, { nowMs: epoch, randomFn: () => 0 });
      expect(decisionRollover.allowed).toBe(true);
      expect(decisionRollover.remainingToday).toBe(4);
    });
  });

  describe('2. OCC Draft-to-Pending Lock in Publish Job Store', () => {
    it('transitions DRAFT -> PENDING successfully and rejects concurrent transitions', async () => {
      const draft = await createPublishJob({
        userId: 'user_pilot_1',
        channelId: 'yt_test_ch',
        platform: 'YOUTUBE_SHORTS',
        videoUrl: 'https://cdn.agencyos.network/v1.mp4',
        title: 'Pilot Video',
        description: 'Pilot Description',
        status: 'DRAFT',
      }, d1);

      expect(draft.status).toBe('DRAFT');
      const updated = await transitionDraftToPending(draft.id, 'user_pilot_1', d1);
      expect(updated.status).toBe('PENDING');

      await expect(
        transitionDraftToPending(draft.id, 'user_pilot_1', d1)
      ).rejects.toThrow(/Draft job not found, unauthorized, or not in DRAFT status/);
    });
  });

  describe('3. Emergency Killswitch Enforcement', () => {
    it('triggers emergency kill switch and short-circuits dispatch with KILL_SWITCH_ACTIVE', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_pilot_1', email: 'pilot@agencyos.network' } as never);
      vi.mocked(setChannelKillSwitch).mockResolvedValue(true);

      const killSwitchRes = await triggerEmergencyKillSwitchAction('yt_test_ch');
      expect(killSwitchRes.success).toBe(true);
      expect(killSwitchRes.data?.killSwitchActive).toBe(true);

      vi.mocked(getCredential).mockResolvedValue({
        id: 'cred_yt_1',
        userId: 'user_pilot_1',
        platform: 'YOUTUBE_SHORTS',
        channelId: 'yt_test_ch',
        channelName: 'Pilot YouTube',
        encryptedTokens: 'enc_vault_tok',
        tokenExpiresAt: epoch + 1000000,
        dailyPostCount: 1,
        killSwitchActive: true,
        lockVersion: 1,
        updatedAt: epoch,
      });

      const dispatchRes = await dispatchSocialPublishAction({
        channelId: 'yt_test_ch',
        platform: 'YOUTUBE_SHORTS',
        videoUrl: 'https://cdn.agencyos.network/pilot.mp4',
        title: 'Blocked Video Due to Kill Switch',
      });

      expect(dispatchRes.success).toBe(false);
      expect(dispatchRes.code).toBe('KILL_SWITCH_ACTIVE');
      expect(dispatchRes.error).toContain('Channel emergency kill switch active');
    });
  });
});
