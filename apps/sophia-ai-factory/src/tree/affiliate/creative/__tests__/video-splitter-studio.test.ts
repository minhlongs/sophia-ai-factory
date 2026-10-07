import { describe, it, expect } from 'vitest';
import {
  generateVideoSegments,
  validateSegmentCompliance,
} from '../video-splitter-studio';

describe('AI Video Creative Studio & Splitter', () => {
  it('generates high-retention segments with duration <= 60s', () => {
    const rawScript = `
      Bạn có biết sản phẩm này đang gây bão toàn mạng không?
      Nó giúp bạn tự động hóa toàn bộ quy trình chỉ trong 3 nốt nhạc.
      Hàng triệu người đã thử và nhận được kết quả vượt mong đợi.
      Hãy xem ngay đường link dưới phần bio để nhận ưu đãi độc quyền hôm nay!
    `;

    const segments = generateVideoSegments({
      campaignId: 'camp_tiktok_001',
      productName: 'Sophia AutoBot',
      rawScript,
      niche: 'saas_global',
      targetDurationSeconds: 45,
    });

    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(segment.durationSeconds).toBeLessThanOrEqual(60);
      expect(segment.hookOverlayText).toContain('SOPHIA AUTOBOT');
      expect(segment.thumbnailHeadline).toBeDefined();

      const compliance = validateSegmentCompliance(segment);
      expect(compliance.isValid).toBe(true);
    }
  });

  it('customizes hooks according to niche context', () => {
    const cryptoSegments = generateVideoSegments({
      campaignId: 'camp_crypto_002',
      productName: 'Solana Bonk 2',
      rawScript: 'Đây là cơ hội token mới tiềm năng. Đừng bỏ lỡ đợt airdrop sắp tới.',
      niche: 'crypto_global',
    });

    expect(cryptoSegments[0].hookOverlayText).toContain('TÍN HIỆU X100');
    expect(cryptoSegments[0].thumbnailHeadline).toContain('Cá mập');
  });

  it('rejects empty or too short scripts', () => {
    expect(() =>
      generateVideoSegments({
        campaignId: 'camp_fail',
        productName: 'Fail',
        rawScript: 'ngắn',
        niche: 'saas_global',
      })
    ).toThrow();
  });
});
