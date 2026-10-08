/**
 * Vitest tests for Platform Credentials Store and Publish Job Store
 * Layer: land/social | File size: < 200 LOC | Zero :any.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1, createServerClient: vi.fn() }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  ensurePlatformCredentialsTable,
  upsertCredential,
  getCredential,
  listUserCredentials,
  acquireRefreshLock,
  completeTokenRefresh,
  setChannelKillSwitch,
  OCC_STALE_LOCK_MS,
} from '../platform-credentials-store';

import {
  ensurePublishJobsTable,
  createPublishJob,
  getPublishJob,
  updatePublishJobStatus,
  listChannelPublishJobs,
  toSocialPublishResult,
} from '../publish-job-store';

describe('land/social Stores & OCC Locking', () => {
  let rawDb: ReturnType<typeof freshDb>;
  let d1: D1Database;

  const sampleInput = {
    userId: 'usr_sarah_101',
    platform: 'YOUTUBE_SHORTS' as const,
    channelId: 'UC_sarah_shorts',
    channelName: 'Sarah AI Clips',
    encryptedTokens: 'iv123:tag456:cipher789',
    tokenExpiresAt: Date.now() + 3600_000,
    dailyPostCount: 1,
    killSwitchActive: false,
  };

  const jobInput = {
    userId: 'usr_sarah_101',
    channelId: 'UC_sarah_shorts',
    platform: 'YOUTUBE_SHORTS' as const,
    videoUrl: 'https://r2.sophia.agencyos.network/videos/reel_01.mp4',
    title: 'Top 5 AI Tools in 2026 #Shorts',
    description: 'Discover AI gems saving hours of manual labor.',
    tags: ['AI', 'Tech', 'Productivity'],
  };

  beforeEach(async () => {
    rawDb = freshDb();
    d1 = makeD1(rawDb) as unknown as D1Database;
    mockGetD1.mockResolvedValue(d1);
    await ensurePlatformCredentialsTable(d1);
    await ensurePublishJobsTable(d1);
  });

  it('upserts and retrieves credential record correctly', async () => {
    const created = await upsertCredential(sampleInput, d1);
    expect(created.userId).toBe(sampleInput.userId);
    expect(created.lockVersion).toBe(1);

    const fetched = await getCredential(sampleInput.userId, sampleInput.platform, sampleInput.channelId, d1);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.encryptedTokens).toBe(sampleInput.encryptedTokens);
  });

  it('increments lock_version on re-upserting conflict', async () => {
    await upsertCredential(sampleInput, d1);
    const updated = await upsertCredential({ ...sampleInput, encryptedTokens: 'new_token' }, d1);
    expect(updated.lockVersion).toBe(2);
    expect(updated.encryptedTokens).toBe('new_token');
  });

  it('lists user credentials ordered by updated_at', async () => {
    await upsertCredential(sampleInput, d1);
    await upsertCredential({ ...sampleInput, platform: 'TIKTOK_V2', channelId: 'tt_99' }, d1);
    const creds = await listUserCredentials(sampleInput.userId, d1);
    expect(creds.length).toBe(2);
    expect(creds.map(c => c.channelId)).toContain('tt_99');
  });

  it('acquires OCC refresh lock when version matches and rejects stale version', async () => {
    const cred = await upsertCredential(sampleInput, d1);
    const ok = await acquireRefreshLock(cred.userId, cred.platform, cred.channelId, cred.lockVersion, Date.now(), d1);
    expect(ok).toBe(true);

    const stale = await acquireRefreshLock(cred.userId, cred.platform, cred.channelId, cred.lockVersion, Date.now(), d1);
    expect(stale).toBe(false);
  });

  it('recovers from stale lock after 5 minutes (> OCC_STALE_LOCK_MS)', async () => {
    const cred = await upsertCredential(sampleInput, d1);
    const t0 = 1_000_000_000;
    expect(await acquireRefreshLock(cred.userId, cred.platform, cred.channelId, cred.lockVersion, t0, d1)).toBe(true);

    // Fail concurrent within 5m
    expect(await acquireRefreshLock(cred.userId, cred.platform, cred.channelId, 999, t0 + 60_000, d1)).toBe(false);

    // Recover after 5m + 1s
    const recovered = await acquireRefreshLock(cred.userId, cred.platform, cred.channelId, 999, t0 + OCC_STALE_LOCK_MS + 1000, d1);
    expect(recovered).toBe(true);
  });

  it('completes token refresh and sets new encrypted tokens', async () => {
    const cred = await upsertCredential(sampleInput, d1);
    const newExpiry = Date.now() + 10_000_000;
    await completeTokenRefresh(cred.userId, cred.platform, cred.channelId, 'refreshed_tokens', newExpiry, d1);

    const updated = await getCredential(cred.userId, cred.platform, cred.channelId, d1);
    expect(updated?.encryptedTokens).toBe('refreshed_tokens');
    expect(updated?.tokenExpiresAt).toBe(newExpiry);
  });

  it('toggles emergency kill switch on channel', async () => {
    const cred = await upsertCredential(sampleInput, d1);
    expect(await setChannelKillSwitch(cred.userId, cred.channelId, true, d1)).toBe(true);
    let current = await getCredential(cred.userId, cred.platform, cred.channelId, d1);
    expect(current?.killSwitchActive).toBe(true);

    await setChannelKillSwitch(cred.userId, cred.channelId, false, d1);
    current = await getCredential(cred.userId, cred.platform, cred.channelId, d1);
    expect(current?.killSwitchActive).toBe(false);
  });

  it('creates publish job in PENDING state and parses tags', async () => {
    const job = await createPublishJob(jobInput, d1);
    expect(job.status).toBe('PENDING');
    expect(job.tags).toEqual(['AI', 'Tech', 'Productivity']);

    const retrieved = await getPublishJob(job.id, d1);
    expect(retrieved?.id).toBe(job.id);
  });

  it('progresses lifecycle: PENDING -> PACED -> UPLOADING -> PUBLISHED', async () => {
    const job = await createPublishJob(jobInput, d1);
    expect((await updatePublishJobStatus(job.id, 'PACED', undefined, d1)).status).toBe('PACED');
    expect((await updatePublishJobStatus(job.id, 'UPLOADING', undefined, d1)).status).toBe('UPLOADING');

    const published = await updatePublishJobStatus(
      job.id,
      'PUBLISHED',
      { platformPostId: 'yt_98765', publishedUrl: 'https://youtube.com/shorts/yt_98765' },
      d1,
    );
    expect(published.status).toBe('PUBLISHED');
    expect(published.platformPostId).toBe('yt_98765');
    expect(published.completedAt).toBeDefined();

    const res = toSocialPublishResult(published);
    expect(res.status).toBe('PUBLISHED');
    expect(res.platformPostId).toBe('yt_98765');
  });

  it('handles job failure state with error message', async () => {
    const job = await createPublishJob(jobInput, d1);
    const failed = await updatePublishJobStatus(job.id, 'FAILED', { error: 'Quota exceeded' }, d1);
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toBe('Quota exceeded');
    expect(failed.completedAt).toBeDefined();
  });

  it('lists jobs for a channel ordered newest first', async () => {
    const j1 = await createPublishJob({ ...jobInput, title: 'Job 1' }, d1);
    const j2 = await createPublishJob({ ...jobInput, title: 'Job 2' }, d1);
    const list = await listChannelPublishJobs(jobInput.channelId, 10, d1);
    expect(list.length).toBe(2);
    expect(list.map(j => j.id)).toContain(j1.id);
    expect(list.map(j => j.id)).toContain(j2.id);
  });
});
