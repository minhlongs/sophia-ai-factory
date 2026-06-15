/**
 * Tests for video:status mission handler.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@/seed/db/client';
import { handle } from './video-status';

const mockCreateServerClient = vi.mocked(createServerClient);

const singleMock = vi.fn();
const eqUserMock = vi.fn(() => ({ single: singleMock }));
const eqVideoMock = vi.fn(() => ({ eq: eqUserMock }));
const selectMock = vi.fn(() => ({ eq: eqVideoMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

const baseCtx = {
  missionId: 'mission-1',
  userId: 'user-1',
  command: 'video:status',
  params: { video_id: 'video-1' },
};

describe('video:status handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerClient.mockReturnValue({ from: fromMock } as never);
    singleMock.mockResolvedValue({
      data: {
        id: 'video-1',
        title: 'Proof video',
        status: 'processing',
        heygen_job_id: 'heygen-job-1',
        video_url: null,
        created_at: '2026-05-22T00:00:00Z',
      },
      error: null,
    });
  });

  it('selects and returns the canonical heygen_job_id column', async () => {
    const result = await handle(baseCtx);

    expect(result.ok).toBe(true);
    expect(selectMock).toHaveBeenCalledWith(
      'id, title, status, heygen_job_id, video_url, created_at',
    );
    expect(result.data).toMatchObject({
      video_id: 'video-1',
      heygen_job_id: 'heygen-job-1',
      heygen_video_id: 'heygen-job-1',
    });
  });

  it('rejects missing video id', async () => {
    const result = await handle({ ...baseCtx, params: {} });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('params.video_id is required');
  });
});
