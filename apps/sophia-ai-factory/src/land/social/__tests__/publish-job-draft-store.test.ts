/**
 * Vitest tests for Draft Publish Job Store and Approval Actions
 * Layer: land/social | File size: < 200 LOC | Zero :any
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';

const { mockGetD1, mockGetCurrentUser, mockInngestSend } = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockInngestSend: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1, createServerClient: vi.fn() }));
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock('@/seed/inngest/client', () => ({ inngest: { send: mockInngestSend } }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  ensurePublishJobsTable,
  createPublishJob,
  listUserDraftJobs,
  transitionDraftToPending,
} from '../publish-job-store';
import {
  listDraftPublishJobsAction,
  approveDraftPublishJobAction,
} from '../actions/social-publisher-draft-actions';

describe('Draft Publish Job Store & 1-Click Approval', () => {
  let rawDb: ReturnType<typeof freshDb>;
  let d1: D1Database;

  const draftInput = {
    userId: 'usr_ceo_42',
    channelId: 'yt_ceo_shorts',
    platform: 'YOUTUBE_SHORTS' as const,
    videoUrl: 'https://r2.sophia.agencyos.network/videos/growth_hack.mp4',
    title: 'Automated Revenue Loops in 2026',
    description: 'Autonomous multi-platform syndication demonstration.',
    tags: ['SaaS', 'Revenue', 'Autonomous'],
    status: 'DRAFT' as const,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    rawDb = freshDb();
    d1 = makeD1(rawDb) as unknown as D1Database;
    mockGetD1.mockResolvedValue(d1);
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_ceo_42', email: 'ceo@agencyos.network' });
    await ensurePublishJobsTable(d1);
  });

  it('creates publish job with DRAFT status', async () => {
    const job = await createPublishJob(draftInput, d1);
    expect(job.status).toBe('DRAFT');
    expect(job.userId).toBe('usr_ceo_42');
    expect(job.title).toBe(draftInput.title);
  });

  it('lists only draft jobs for a given user', async () => {
    const d1Job = await createPublishJob(draftInput, d1);
    const d2Job = await createPublishJob({ ...draftInput, title: 'Draft Two' }, d1);
    // Non-draft job
    await createPublishJob({ ...draftInput, status: 'PENDING' }, d1);
    // Different user draft
    await createPublishJob({ ...draftInput, userId: 'usr_other_99' }, d1);

    const userDrafts = await listUserDraftJobs('usr_ceo_42', 10, d1);
    expect(userDrafts.length).toBe(2);
    const draftIds = userDrafts.map((d) => d.id);
    expect(draftIds).toContain(d1Job.id);
    expect(draftIds).toContain(d2Job.id);
  });

  it('atomically transitions DRAFT to PENDING', async () => {
    const draft = await createPublishJob(draftInput, d1);
    expect(draft.status).toBe('DRAFT');

    const pending = await transitionDraftToPending(draft.id, 'usr_ceo_42', d1);
    expect(pending.status).toBe('PENDING');
  });

  it('fails transitionDraftToPending if not authorized or not DRAFT', async () => {
    const draft = await createPublishJob(draftInput, d1);
    // Wrong user
    await expect(transitionDraftToPending(draft.id, 'usr_attacker', d1)).rejects.toThrow();

    // Already transitioned to PENDING
    await transitionDraftToPending(draft.id, 'usr_ceo_42', d1);
    await expect(transitionDraftToPending(draft.id, 'usr_ceo_42', d1)).rejects.toThrow();
  });

  it('approveDraftPublishJobAction transitions draft and dispatches Inngest event', async () => {
    const draft = await createPublishJob(draftInput, d1);
    mockInngestSend.mockResolvedValue({ ids: ['evt_test_1'] });

    const result = await approveDraftPublishJobAction(draft.id);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('PENDING');

    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'social.publish.dispatched',
      data: expect.objectContaining({
        jobId: draft.id,
        userId: 'usr_ceo_42',
        channelId: draft.channelId,
        platform: 'YOUTUBE_SHORTS',
        videoUrl: draft.videoUrl,
        title: draft.title,
      }),
    });
  });

  it('listDraftPublishJobsAction returns user drafts via Better Auth session', async () => {
    await createPublishJob(draftInput, d1);
    const res = await listDraftPublishJobsAction(10);
    expect(res.success).toBe(true);
    expect(res.data?.length).toBe(1);
    expect(res.data?.[0]?.title).toBe(draftInput.title);
  });
});
