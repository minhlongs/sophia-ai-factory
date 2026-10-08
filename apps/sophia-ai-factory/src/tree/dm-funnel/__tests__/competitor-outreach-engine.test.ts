/**
 * @file competitor-outreach-engine.test.ts
 * @description Unit tests for competitor video comment prospecting engine
 */

import { describe, it, expect } from 'vitest';
import { evaluateCompetitorOutreach } from '../competitor-outreach-engine';

describe('evaluateCompetitorOutreach', () => {
  it('detects PRICE_SEEKING intent with high priority', () => {
    const result = evaluateCompetitorOutreach({
      commentText: 'Cho mình hỏi bộ này bao nhiêu tiền vậy shop?',
      authorUsername: 'tuan_tech',
      competitorTopic: 'Tai nghe Bluetooth chống ồn',
      targetOfferName: 'Tai Nghe Pro ANC 2',
      targetDiscountPercentage: 25,
    });

    expect(result.isEligibleForOutreach).toBe(true);
    expect(result.detectedIntentType).toBe('PRICE_SEEKING');
    expect(result.intentScore).toBe(92);
    expect(result.outreachMessage).toContain('giảm 25%');
    expect(result.outreachMessage).toContain('tuan_tech');
  });

  it('detects PRODUCT_LINK intent with maximum priority', () => {
    const result = evaluateCompetitorOutreach({
      commentText: 'Xin link mua ở đâu uy tín với ạ',
      authorUsername: 'linh_nga',
      competitorTopic: 'Bàn phím cơ',
      targetOfferName: 'Bàn Phím Cơ Custom RGB',
    });

    expect(result.isEligibleForOutreach).toBe(true);
    expect(result.detectedIntentType).toBe('PRODUCT_LINK');
    expect(result.intentScore).toBe(96);
  });

  it('detects DISSATISFACTION when user complains about competitor', () => {
    const result = evaluateCompetitorOutreach({
      commentText: 'Hàng này đắt quá mà dùng chán ngắt',
      authorUsername: 'minh_hoang',
      competitorTopic: 'Sạc nhanh 65W',
      targetOfferName: 'Củ Sạc GaN 65W Ultra',
    });

    expect(result.isEligibleForOutreach).toBe(true);
    expect(result.detectedIntentType).toBe('DISSATISFACTION');
    expect(result.intentScore).toBe(85);
    expect(result.outreachMessage).toContain('1 đổi 1');
  });

  it('filters out neutral or non-intent comments', () => {
    const result = evaluateCompetitorOutreach({
      commentText: 'Video hay quá bạn ơi',
      authorUsername: 'viewer_01',
      competitorTopic: 'Đánh giá đồ gia dụng',
      targetOfferName: 'Robot Hút Bụi T10',
    });

    expect(result.isEligibleForOutreach).toBe(false);
    expect(result.detectedIntentType).toBe('NEUTRAL');
    expect(result.outreachMessage).toBe('');
    expect(result.complianceWarning).toBeDefined();
  });
});
