/**
 * Tests for video:create mission handler.
 *
 * Guards the canonical HeyGen column used by webhook/status/distribution flows:
 * videos.heygen_job_id. The old heygen_video_id name is kept only as a
 * response alias for client compatibility.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1Raw: vi.fn().mockResolvedValue({
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    }),
  }),
}));

vi.mock('@/tree/credentials/get-provider-key', () => ({
  getHeyGenKey: vi.fn(),
}));

vi.mock('@/land/video/heygen-helpers', () => ({
  createHeyGenVideo: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn() },
}));

import { createServerClient } from '@/seed/db/client';
import { getHeyGenKey } from '@/tree/credentials/get-provider-key';
import { createHeyGenVideo } from '@/land/video/heygen-helpers';
import { handle } from './video-create';

const mockCreateServerClient = vi.mocked(createServerClient);
const mockGetHeyGenKey = vi.mocked(getHeyGenKey);
const mockCreateHeyGenVideo = vi.mocked(createHeyGenVideo);

const insertMock = vi.fn();
const eqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ insert: insertMock, update: updateMock }));

const baseCtx = {
  missionId: 'mission-1',
  userId: 'user-1',
  command: 'video:create',
  params: {
    script: 'Hello from Sophia',
    title: 'Sophia proof video',
  },
};

describe('video:create handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ data: null, error: null });
    eqMock.mockResolvedValue({ data: null, error: null });
    updateMock.mockImplementation(() => ({ eq: eqMock }));
    fromMock.mockImplementation(() => ({ insert: insertMock, update: updateMock }));
    mockCreateServerClient.mockReturnValue({ from: fromMock } as never);
    mockGetHeyGenKey.mockResolvedValue({ key: 'hg_user_key', source: 'user' });
    mockCreateHeyGenVideo.mockResolvedValue({ videoId: 'heygen-job-1' });
  });

  it('writes heygen_job_id after HeyGen accepts the render job', async () => {
    const result = await handle(baseCtx);

    expect(result.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        status: 'queued',
        source: 'mission',
      }),
    );
    expect(updateMock).toHaveBeenCalledWith({
      status: 'processing',
      heygen_job_id: 'heygen-job-1',
    });
    expect(eqMock).toHaveBeenCalledWith('id', expect.any(String));
    expect(result.data).toMatchObject({
      heygen_job_id: 'heygen-job-1',
      heygen_video_id: 'heygen-job-1',
      status: 'processing',
    });
  });

  it('fails before insert when the user has no HeyGen credential', async () => {
    mockGetHeyGenKey.mockResolvedValue(null);

    const result = await handle(baseCtx);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('HeyGen API key not configured');
    expect(insertMock).not.toHaveBeenCalled();
    expect(mockCreateHeyGenVideo).not.toHaveBeenCalled();
  });
});
