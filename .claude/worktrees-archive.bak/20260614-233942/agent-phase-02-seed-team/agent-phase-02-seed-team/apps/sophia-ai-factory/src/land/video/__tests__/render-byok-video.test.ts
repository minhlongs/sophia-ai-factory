/**
 * Unit tests for the BYOK HeyGen render-submit step.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/tree/credentials/get-provider-key', () => ({
  getHeyGenKey: vi.fn(),
}));

vi.mock('@/land/video/heygen-helpers', () => ({
  createHeyGenVideo: vi.fn(),
}));

const mockRun = vi.fn().mockResolvedValue({});
const mockBind = vi.fn(() => ({ run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));
vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(() => Promise.resolve({ prepare: mockPrepare })),
}));

import { getHeyGenKey } from '@/tree/credentials/get-provider-key';
import { createHeyGenVideo } from '@/land/video/heygen-helpers';
import { submitByokVideo, RenderByokVideoError } from '@/land/video/render-byok-video';

const mockedGetHeyGenKey = vi.mocked(getHeyGenKey);
const mockedCreateHeyGen = vi.mocked(createHeyGenVideo);

describe('submitByokVideo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRun.mockResolvedValue({});
    mockBind.mockImplementation(() => ({ run: mockRun }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
  });

  it('submits to HeyGen + inserts videos row when key is present', async () => {
    mockedGetHeyGenKey.mockResolvedValue({ key: 'hg_key_abc', source: 'user' });
    mockedCreateHeyGen.mockResolvedValue({ videoId: 'hg_job_xyz' });

    const result = await submitByokVideo({
      userId: 'u1',
      script: '# Title\n\nBody.',
      title: 'auto mission',
    });

    expect(result.status).toBe('processing');
    expect(result.heygenJobId).toBe('hg_job_xyz');
    expect(result.videoId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(mockedGetHeyGenKey).toHaveBeenCalledWith({
      userId: 'u1',
      fallbackToPlatform: false,
    });
    expect(mockedCreateHeyGen).toHaveBeenCalledOnce();
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO videos'),
    );
  });

  it('throws BYOK_REQUIRED when no HeyGen key is configured', async () => {
    mockedGetHeyGenKey.mockResolvedValue(null);

    await expect(
      submitByokVideo({ userId: 'u1', script: 'x' }),
    ).rejects.toMatchObject({ code: 'BYOK_REQUIRED' });

    expect(mockedCreateHeyGen).not.toHaveBeenCalled();
  });

  it('throws EMPTY_SCRIPT on blank input', async () => {
    await expect(
      submitByokVideo({ userId: 'u1', script: '   ' }),
    ).rejects.toMatchObject({ code: 'EMPTY_SCRIPT' });
  });

  it('throws HEYGEN_SUBMIT_FAILED when HeyGen call rejects', async () => {
    mockedGetHeyGenKey.mockResolvedValue({ key: 'hg_key', source: 'user' });
    mockedCreateHeyGen.mockRejectedValue(new Error('HeyGen createVideo 402: payment required'));

    await expect(
      submitByokVideo({ userId: 'u1', script: 'body' }),
    ).rejects.toBeInstanceOf(RenderByokVideoError);
  });

  it('throws PERSIST_FAILED when D1 insert fails', async () => {
    mockedGetHeyGenKey.mockResolvedValue({ key: 'hg_key', source: 'user' });
    mockedCreateHeyGen.mockResolvedValue({ videoId: 'hg_job_xyz' });
    mockRun.mockRejectedValueOnce(new Error('D1 timeout'));

    await expect(
      submitByokVideo({ userId: 'u1', script: 'body' }),
    ).rejects.toMatchObject({ code: 'PERSIST_FAILED' });
  });
});
