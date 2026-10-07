import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BridgePage from '../page';
import * as clickRecorder from '@/land/affiliates/click-recorder';
import * as geoRouter from '@/land/affiliates/routing/geo-router';
import { notFound } from 'next/navigation';

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
        referer: 'https://youtube.com/shorts/123',
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

describe('BridgePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records click with request headers and renders redirect destination with sub_id', async () => {
    const Component = await BridgePage({
      params: Promise.resolve({ locale: 'vi', productId: 'saas_marketing_automation' }),
    });

    render(Component);

    expect(clickRecorder.recordClick).toHaveBeenCalledTimes(1);
    expect(clickRecorder.recordClick).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'default',
        linkId: 'saas_marketing_automation',
        offerId: 'saas_marketing_automation',
        ip: '203.0.113.195',
        country: 'VN',
        userAgent: 'Mozilla/5.0 TestBrowser',
        referrer: 'https://youtube.com/shorts/123',
      }),
    );

    expect(geoRouter.getAffiliateRoute).toHaveBeenCalled();
    expect(screen.getByText('Redirecting to best offer...')).toBeDefined();
    expect(
      screen.getByText(/We are finding the best deal for your region \(saas_marketing_automation\)/),
    ).toBeDefined();

    const link = screen.getByRole('link', { name: /Click here if not redirected automatically/ });
    expect(link.getAttribute('href')).toContain('https://affiliate.localvn.com/v1');
    expect(link.getAttribute('href')).toContain('sub_id=');
  });

  it('triggers notFound() when productId does not match valid prefixes', async () => {
    await expect(
      BridgePage({
        params: Promise.resolve({ locale: 'vi', productId: 'invalid_clothing_item' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
    expect(clickRecorder.recordClick).not.toHaveBeenCalled();
  });
});
