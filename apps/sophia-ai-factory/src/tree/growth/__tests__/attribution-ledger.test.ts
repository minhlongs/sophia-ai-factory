import { describe, it, expect } from 'vitest';
import { recordConversion, getVideoLTVScore, type AttributionRecord } from '../attribution-ledger';

describe('attribution-ledger', () => {
  describe('recordConversion', () => {
    it('successfully appends valid conversion', () => {
      const ledger: AttributionRecord[] = [];
      const conversion: AttributionRecord = {
        videoId: 'vid-123',
        conversionId: 'conv-1',
        revenueCents: 5000,
        timestamp: 123456
      };

      const result = recordConversion(ledger, conversion);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0]).toEqual(conversion);
      }
    });

    it('rejects duplicate conversionId', () => {
      const ledger: AttributionRecord[] = [{
        videoId: 'vid-123',
        conversionId: 'conv-1',
        revenueCents: 5000,
        timestamp: 123456
      }];
      
      const result = recordConversion(ledger, {
        videoId: 'vid-123',
        conversionId: 'conv-1',
        revenueCents: 2000,
        timestamp: 123457
      });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Duplicate');
      }
    });

    it('rejects negative revenue', () => {
      const result = recordConversion([], {
        videoId: 'vid-123',
        conversionId: 'conv-1',
        revenueCents: -50,
        timestamp: 123456
      });
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('negative');
      }
    });
  });

  describe('getVideoLTVScore', () => {
    it('aggregates correctly and calculates LTV score', () => {
      const ledger: AttributionRecord[] = [
        { videoId: 'v1', conversionId: 'c1', revenueCents: 5000, timestamp: 1 },
        { videoId: 'v1', conversionId: 'c2', revenueCents: 3000, timestamp: 2 },
        { videoId: 'v2', conversionId: 'c3', revenueCents: 1000, timestamp: 3 }
      ];

      const spend = [
        { videoId: 'v1', spendCents: 1000 },
        { videoId: 'v1', spendCents: 1000 },
        { videoId: 'v2', spendCents: 500 }
      ];

      const result = getVideoLTVScore(ledger, spend, 'v1');
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        // v1 total spend = 2000
        // v1 revenue = 8000, conversions = 2
        // ROAS = 4
        // ltvScore = 8000 * 4 = 32000
        expect(result.value).toBe(32000);
      }
    });

    it('returns error if no spend records exist', () => {
      const result = getVideoLTVScore([], [], 'v1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No spend records');
      }
    });
  });
});
