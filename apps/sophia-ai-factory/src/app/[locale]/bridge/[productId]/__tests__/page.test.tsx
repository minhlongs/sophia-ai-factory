import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BridgeRoute from '../page';
import * as clickRecorder from '@/land/affiliates/click-recorder';
import * as geoRouter from '@/land/affiliates/routing/geo-router';

vi.mock('next/navigation', () => ({
  notFound: vi.fn().mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockImplementation((name: string) => {
      const h: Record<string, string> = {
        'cf-connecting-ip': '203.0.113.195',
        'cf-ipcountry': 'VN',
        'user-agent': 'Mozilla/5.0 TestBrowser',
        referer: 'https://tiktok.com/@creator/video/123',
      };
      return h[name.toLowerCase()] ?? null;
    }),
  }),
}));

vi.mock('@/land/affiliates/click-recorder', () => ({
  recordClick: vi.fn().mockResolvedValue('test-click-id'),
}));

vi.mock('@/land/affiliates/routing/geo-router', () => ({
  getAffiliateRoute: vi.fn().mockReturnValue('https://affiliate.localvn.com/v1'),
}));

describe('BridgeRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records click with geolocation and renders high-converting bridge page', async () => {
    const Component = await BridgeRoute({
      params: Promise.resolve({ locale: 'vi', productId: 'saas_ai_assistant' }),
    });

    render(Component);

    expect(clickRecorder.recordClick).toHaveBeenCalledTimes(1);
    expect(clickRecorder.recordClick).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'default',
        linkId: 'saas_ai_assistant',
        offerId: 'saas_ai_assistant',
        ip: '203.0.113.195',
        country: 'VN',
        userAgent: 'Mozilla/5.0 TestBrowser',
        referrer: 'https://tiktok.com/@creator/video/123',
      }),
    );

    expect(geoRouter.getAffiliateRoute).toHaveBeenCalled();
    expect(screen.getByText(/Tự Động Hóa 80% Quy Trình/)).toBeDefined();
    expect(screen.getByText('SOPHIA20')).toBeDefined();
    expect(screen.getByText('Nhận Ưu Đãi & Dùng Thử Ngay')).toBeDefined();

    const ctaLink = screen.getByRole('link', { name: /Nhận Ưu Đãi & Dùng Thử Ngay/ });
    expect(ctaLink.getAttribute('href')).toContain('https://affiliate.localvn.com/v1');
    expect(ctaLink.getAttribute('href')).toContain('sub_id=');
  });

  it('rejects invalid product identifier with notFound', async () => {
    await expect(
      BridgeRoute({
        params: Promise.resolve({ locale: 'vi', productId: 'invalid_product_id' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
