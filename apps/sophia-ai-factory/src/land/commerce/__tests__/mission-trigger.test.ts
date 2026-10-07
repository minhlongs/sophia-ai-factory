/**
 * Unit tests for E-Commerce mission trigger
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerProductVideoMission } from '../mission-trigger';

const mocks = vi.hoisted(() => ({
  createMission: vi.fn(),
}));

vi.mock('@/land/creative-mission/actions', () => ({
  createMission: mocks.createMission,
}));

describe('triggerProductVideoMission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleProduct = {
    id: 'prod_99',
    platform: 'shopify' as const,
    title: 'Aesthetic Sunset Lamp',
    description: 'Transform any room into a cozy haven with 16 ambient color modes.',
    tags: ['home-decor', 'lighting'],
    price: 34.99,
    currency: 'USD',
    images: ['https://example.com/lamp.jpg'],
    status: 'active' as const,
    rawMetadata: {},
  };

  it('rejects missing workspaceId with VALIDATION_ERROR', async () => {
    const res = await triggerProductVideoMission({
      workspaceId: '',
      product: sampleProduct,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('successfully triggers creative mission and formats constraints', async () => {
    mocks.createMission.mockResolvedValue({
      ok: true,
      value: {
        missionId: 'msn_auto_ecommerce_123',
      },
    });

    const res = await triggerProductVideoMission({
      workspaceId: 'ws_shop_1',
      product: sampleProduct,
      brandId: 'brd_aesthetic',
      autonomyLevel: 2,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.missionId).toBe('msn_auto_ecommerce_123');
      expect(res.value.product.title).toBe('Aesthetic Sunset Lamp');
    }

    expect(mocks.createMission).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_shop_1',
        title: expect.stringContaining('Aesthetic Sunset Lamp'),
        autonomyLevel: 2,
        brandId: 'brd_aesthetic',
        channels: ['tiktok', 'youtube_shorts', 'facebook_reels'],
        constraints: expect.objectContaining({
          productId: 'prod_99',
          platform: 'shopify',
          price: 34.99,
        }),
      })
    );
  });

  it('forwards createMission error on failure', async () => {
    mocks.createMission.mockResolvedValue({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to write mission row' },
    });

    const res = await triggerProductVideoMission({
      workspaceId: 'ws_shop_1',
      product: sampleProduct,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('DB_ERROR');
    }
  });
});
