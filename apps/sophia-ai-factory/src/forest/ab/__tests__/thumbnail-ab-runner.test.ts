import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findVideosNeedingExperiments,
  createThumbnailAbExperiment,
  selectWinningThumbnail,
} from '../thumbnail-ab-runner';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/forest/ab/experiment-store', () => ({
  createExperiment: vi.fn(),
}));

vi.mock('@/forest/ab/variant-generator', () => ({
  generateVariants: vi.fn(),
}));

import { getD1 } from '@/seed/db/client';

describe('Thumbnail A/B Runner Facade', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws error when D1 is not available in findVideosNeedingExperiments', async () => {
    vi.mocked(getD1).mockResolvedValue(null as never);
    await expect(findVideosNeedingExperiments()).rejects.toThrow('D1 database binding not available');
  });

  it('throws error when D1 is not available in selectWinningThumbnail', async () => {
    vi.mocked(getD1).mockResolvedValue(null as never);
    await expect(selectWinningThumbnail('v1', 'a', 'https://thumb.url')).rejects.toThrow(
      'D1 database binding not available',
    );
  });

  it('safely handles missing thumbnail url in selectWinningThumbnail', async () => {
    await expect(selectWinningThumbnail('v1', 'a', undefined)).resolves.toBeUndefined();
  });

  it('throws error when D1 is not available in createThumbnailAbExperiment', async () => {
    vi.mocked(getD1).mockResolvedValue(null as never);
    await expect(
      createThumbnailAbExperiment({
        videoId: 'v1',
        tenantId: 't1',
        originalCaption: 'Cap',
      }),
    ).rejects.toThrow('D1 database binding not available');
  });
});
