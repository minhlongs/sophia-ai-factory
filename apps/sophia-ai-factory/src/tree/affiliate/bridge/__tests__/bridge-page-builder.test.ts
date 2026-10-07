import { describe, it, expect } from 'vitest';
import { buildBridgePageData } from '../bridge-page-builder';

describe('buildBridgePageData', () => {
  it('constructs SaaS bridge data in Vietnamese by default', () => {
    const data = buildBridgePageData({
      productId: 'saas_productivity_ai',
      destinationUrl: 'https://partner.saas.com/aff?ref=sophia',
    });

    expect(data.niche).toBe('saas');
    expect(data.locale).toBe('vi');
    expect(data.country).toBe('VN');
    expect(data.vanityCoupon.code).toBe('SOPHIA20');
    expect(data.headline).toContain('Tự Động Hóa 80%');
    expect(data.destinationUrl).toBe('https://partner.saas.com/aff?ref=sophia');
    expect(data.bulletPoints.length).toBeGreaterThanOrEqual(3);
  });

  it('constructs SaaS bridge data in English when requested', () => {
    const data = buildBridgePageData({
      productId: 'saas_editor',
      locale: 'en',
      country: 'US',
      destinationUrl: 'https://partner.saas.com/aff?ref=sophia',
    });

    expect(data.niche).toBe('saas');
    expect(data.locale).toBe('en');
    expect(data.country).toBe('US');
    expect(data.vanityCoupon.discountText).toBe('20% OFF Annual Subscription');
    expect(data.ctaLabel).toBe('Claim Exclusive Offer & Start Free');
  });

  it('constructs Crypto bridge data with crypto vanity coupons', () => {
    const data = buildBridgePageData({
      productId: 'crypto_perps_dex',
      locale: 'vi',
      country: 'VN',
      destinationUrl: 'https://dex.exchange/ref/sophia',
    });

    expect(data.niche).toBe('crypto');
    expect(data.vanityCoupon.code).toBe('SOPHIAVIP');
    expect(data.headline).toContain('Khớp Lệnh Cực Nhanh');
    expect(data.destinationUrl).toBe('https://dex.exchange/ref/sophia');
  });

  it('constructs Crypto bridge data in English', () => {
    const data = buildBridgePageData({
      productId: 'crypto_spot_cex',
      locale: 'en',
      country: 'SG',
      destinationUrl: 'https://cex.exchange/ref/sophia',
    });

    expect(data.niche).toBe('crypto');
    expect(data.locale).toBe('en');
    expect(data.country).toBe('SG');
    expect(data.vanityCoupon.discountText).toBe('30% Lifetime Trading Fee Rebate');
    expect(data.ctaLabel).toBe('Claim VIP Pass & Register Now');
  });
});
