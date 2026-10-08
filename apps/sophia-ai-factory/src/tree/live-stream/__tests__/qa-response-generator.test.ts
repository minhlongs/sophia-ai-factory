/**
 * @file qa-response-generator.test.ts
 * @description Unit tests for Live-Commerce Q&A Synthesizer
 */

import { describe, it, expect } from 'vitest';
import { generateLiveQaResponse } from '@/tree/live-stream/qa-response-generator';

describe('LiveQaResponseGenerator', () => {
  it('generates sub-850ms turnaround price objection response', () => {
    const response = generateLiveQaResponse({
      sessionId: 'sess_1',
      commentText: 'Sản phẩm này giá bao nhiêu vậy shop?',
      username: 'Thảo Nhi',
      productTitle: 'Serum Vitamin C Pure',
    });

    expect(response.turnaroundEstMs).toBeLessThanOrEqual(850);
    expect(response.sentiment).toBe('PRICE_OBJECTION');
    expect(response.highlightOfferPinned).toBe(true);
    expect(response.spokenText).toContain('voucher giảm trực tiếp');
  });

  it('generates trust and quality reassurance response', () => {
    const response = generateLiveQaResponse({
      sessionId: 'sess_1',
      commentText: 'Hàng này có uy tín và bảo hành không shop?',
      username: 'Huy Hoàng',
      productTitle: 'Tai nghe Bluetooth Pro',
    });

    expect(response.highlightOfferPinned).toBe(true);
    expect(response.spokenText).toContain('100% chính hãng');
  });

  it('handles general greeting comments politely', () => {
    const response = generateLiveQaResponse({
      sessionId: 'sess_1',
      commentText: 'Hello shop nha',
      username: 'Minh',
      productTitle: 'Kem chống nắng SunGuard',
    });

    expect(response.sentiment).toBe('INQUIRY');
    expect(response.spokenText).toContain('Minh');
  });
});
