import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBrandKitAction,
  saveBrandKitAction,
  removeBrandAssetAction,
} from '../brand-kit-action';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/repositories/brand-kits-repo', () => ({
  getBrandKit: vi.fn(),
  upsertBrandKit: vi.fn(),
  deleteBrandKitAsset: vi.fn(),
}));

vi.mock('@/land/video/storage/r2-binding', () => ({
  getVideoBucket: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';

describe('BrandKit Server Actions Facade', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests for getBrandKitAction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getBrandKitAction();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Not authenticated');
    }
  });

  it('rejects unauthenticated requests for saveBrandKitAction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await saveBrandKitAction({ primaryColor: '#123456' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Not authenticated');
    }
  });

  it('rejects invalid asset types in removeBrandAssetAction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as never);
    const result = await removeBrandAssetAction('invalid_type');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Invalid asset type');
    }
  });
});
