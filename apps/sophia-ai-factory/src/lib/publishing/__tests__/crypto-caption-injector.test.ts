/**
 * crypto-caption-injector.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { injectCryptoDisclaimer } from '../crypto-caption-injector';

describe('injectCryptoDisclaimer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns original caption untouched for non-crypto vertical', async () => {
    const result = await injectCryptoDisclaimer({
      caption: 'Buy this great product!',
      vertical: 'ecommerce',
      targetJurisdiction: 'US',
      channelId: 'tiktok',
    });
    expect(result.injected).toBe(false);
    expect(result.blocked).toBe(false);
    expect(result.caption).toBe('Buy this great product!');
  });

  it('blocks crypto content for VN jurisdiction', async () => {
    const result = await injectCryptoDisclaimer({
      caption: 'Trade Bitcoin now!',
      vertical: 'crypto',
      targetJurisdiction: 'VN',
      channelId: 'youtube',
    });
    expect(result.blocked).toBe(true);
    expect(result.injected).toBe(false);
    expect(result.blockReason).toBeDefined();
    expect(result.blockReason).toContain('Vietnam');
  });

  it('blocks zalo channel for crypto regardless of jurisdiction', async () => {
    const result = await injectCryptoDisclaimer({
      caption: 'Crypto offer here',
      vertical: 'crypto',
      targetJurisdiction: 'US',
      channelId: 'zalo',
    });
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('zalo');
  });

  it('injects US disclaimer into caption for US jurisdiction', async () => {
    const result = await injectCryptoDisclaimer({
      caption: 'Great crypto opportunity!',
      vertical: 'crypto',
      targetJurisdiction: 'US',
      channelId: 'tiktok',
    });
    expect(result.blocked).toBe(false);
    expect(result.injected).toBe(true);
    expect(result.caption).toContain('#ad');
    expect(result.caption).toContain('Great crypto opportunity!');
    expect(result.disclaimerHash).toBeDefined();
    expect(result.disclaimerHash?.length).toBe(16);
  });

  it('injects EU disclaimer with MiCA reference', async () => {
    const result = await injectCryptoDisclaimer({
      caption: 'Invest in crypto!',
      vertical: 'crypto',
      targetJurisdiction: 'EU',
      channelId: 'instagram',
    });
    expect(result.caption).toContain('MiCA');
    expect(result.injected).toBe(true);
  });

  it('injects Vietnamese-language disclaimer when locale=vi', async () => {
    const result = await injectCryptoDisclaimer({
      caption: 'Đầu tư crypto',
      vertical: 'crypto',
      targetJurisdiction: 'US',
      channelId: 'youtube',
      locale: 'vi',
    });
    expect(result.caption).toContain('biến động cao');
  });

  it('does not double-inject if disclaimer already present', async () => {
    const firstResult = await injectCryptoDisclaimer({
      caption: 'Crypto deal',
      vertical: 'crypto',
      targetJurisdiction: 'SG',
      channelId: 'tiktok',
    });
    const secondResult = await injectCryptoDisclaimer({
      caption: firstResult.caption,
      vertical: 'crypto',
      targetJurisdiction: 'SG',
      channelId: 'tiktok',
    });
    expect(secondResult.injected).toBe(false);
    // Caption should not have disclaimer repeated
    const occurrences = (secondResult.caption.match(/#ad/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('uses SG disclaimer for Singapore jurisdiction', async () => {
    const result = await injectCryptoDisclaimer({
      caption: 'DPT trading offer',
      vertical: 'crypto',
      targetJurisdiction: 'SG',
      channelId: 'youtube',
    });
    expect(result.caption).toContain('MAS');
    expect(result.blocked).toBe(false);
  });

  it('uses JP disclaimer for Japan jurisdiction', async () => {
    const result = await injectCryptoDisclaimer({
      caption: 'Crypto offer for Japan',
      vertical: 'crypto',
      targetJurisdiction: 'JP',
      channelId: 'youtube',
    });
    expect(result.caption).toContain('FSA');
    expect(result.blocked).toBe(false);
  });
});
