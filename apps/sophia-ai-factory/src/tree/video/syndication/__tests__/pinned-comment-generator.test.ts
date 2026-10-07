/**
 * Unit Tests for Pinned Comment Generator
 *
 * Validates compliance disclosures, vanity coupon injection, and bilingual formatting.
 * @module tree/video/syndication/__tests__/pinned-comment-generator.test
 */

import { describe, it, expect } from 'vitest';
import { generatePinnedComment } from '../pinned-comment-generator';

describe('Pinned Comment Generator', () => {
  it('generates English SaaS pinned comment with ad disclosure and vanity coupon', () => {
    const res = generatePinnedComment({
      productName: 'Linear AI',
      trackedUrl: 'https://linear.app?via=sophia',
      niche: 'saas_global',
      vanityCoupon: 'LINEAR20',
      locale: 'en',
    });

    expect(res.hasDisclaimer).toBe(true);
    expect(res.couponCode).toBe('LINEAR20');
    expect(res.trackedUrl).toBe('https://linear.app?via=sophia');
    expect(res.text).toContain('Linear AI exclusive free trial');
    expect(res.text).toContain('Discount Code: LINEAR20');
    expect(res.text).toContain('Ad disclosure: We may earn a commission');
  });

  it('generates Vietnamese SaaS pinned comment with localized disclosure', () => {
    const res = generatePinnedComment({
      productName: 'Notion AI',
      trackedUrl: 'https://notion.so?via=sophia',
      niche: 'saas_global',
      vanityCoupon: 'NOTION50',
      locale: 'vi',
    });

    expect(res.text).toContain('Trải nghiệm Notion AI với ưu đãi');
    expect(res.text).toContain('Mã giảm giá: NOTION50');
    expect(res.text).toContain('Minh bạch: Kênh có thể nhận hoa hồng');
  });

  it('generates English Crypto pinned comment with risk disclaimer (FTC/MiCA)', () => {
    const res = generatePinnedComment({
      productName: 'Binance Futures',
      trackedUrl: 'https://binance.com/ref/SOPHIA',
      niche: 'crypto_global',
      vanityCoupon: 'CRYPTO100',
      locale: 'en',
    });

    expect(res.text).toContain('Claim exclusive bonus & fee discount on Binance Futures');
    expect(res.text).toContain('Promo Code: CRYPTO100');
    expect(res.text).toContain('Disclaimer: Crypto trading involves risk. Not financial advice (FTC/MiCA).');
  });

  it('generates Vietnamese Crypto pinned comment without coupon if omitted', () => {
    const res = generatePinnedComment({
      productName: 'Bybit Derivatives',
      trackedUrl: 'https://bybit.com/invite/SOPHIA',
      niche: 'crypto_global',
      locale: 'vi',
    });

    expect(res.couponCode).toBeUndefined();
    expect(res.text).toContain('Nhận thưởng nạp và giảm phí độc quyền trên Bybit Derivatives');
    expect(res.text).not.toContain('Mã giới thiệu:');
    expect(res.text).toContain('Lưu ý: Giao dịch Crypto có rủi ro');
  });
});
