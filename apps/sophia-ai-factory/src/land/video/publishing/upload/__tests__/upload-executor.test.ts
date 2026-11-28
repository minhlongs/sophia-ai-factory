import { describe, it, expect, vi } from 'vitest';

const mockUpload = vi.fn();
vi.mock('../publisher-factory', () => ({
  buildPublisher: () => ({ upload: (...args: unknown[]) => mockUpload(...args) }),
}));

import { uploadToProvider } from '../upload-executor';

describe('uploadToProvider — ambiguous timeout and non-retriable safety', () => {
  it('treats ambiguous AbortError/TimeoutError as non-retriable and does NOT schedule blind retry', async () => {
    const updateEq = vi.fn(async () => ({ error: null }));
    const db = {
      from: () => ({ update: () => ({ eq: updateEq }) }),
    } as never;
    const scheduleRetry = vi.fn(async () => {});

    const timeoutErr = Object.assign(new Error('Provider request timed out'), { name: 'AbortError' });
    mockUpload.mockRejectedValueOnce(timeoutErr);

    const res = await uploadToProvider({
      channel: { id: 'ch_1', provider: 'youtube' } as never,
      accessToken: 'tok',
      videoUrl: 'r2://private/distribution/org/user/art/v1-' + 'a'.repeat(64) + '.mp4',
      job: { id: 'job_1', caption: 'test', retry_count: 0 } as never,
      db,
      jobId: 'job_1',
      retryCount: 1,
      scheduleRetry,
      tenantId: 'org-1',
      userId: 'user-1',
    });

    expect(res.shouldRetry).toBe(false);
    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(updateEq).toHaveBeenCalledWith('id', 'job_1');
  });
});
