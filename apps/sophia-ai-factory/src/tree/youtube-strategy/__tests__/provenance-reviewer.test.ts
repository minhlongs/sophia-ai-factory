import { describe, it, expect } from 'vitest';
import { buildProvenance, type ProvenanceInput } from '../provenance-reviewer';

describe('provenance-reviewer', () => {
  describe('buildProvenance', () => {
    it('returns a provenance record with correct structure', () => {
      const input: ProvenanceInput = {
        sources: [
          { url: 'https://example.com/article', title: 'Article', sourceType: 'article' },
        ],
        claims: [
          { text: 'Python is popular', riskLevel: 'standard', sourceUrls: ['https://example.com/article'] },
        ],
      };
      const result = buildProvenance(input);
      expect(result.sources).toHaveLength(1);
      expect(result.claims).toHaveLength(1);
    });

    it('preserves source URLs as provided', () => {
      const input: ProvenanceInput = {
        sources: [
          { url: 'https://example.com/Article/', title: 'Test', sourceType: 'video' },
        ],
        claims: [],
      };
      const result = buildProvenance(input);
      expect(result.sources[0].url).toBe('https://example.com/Article/');
    });

    it('assigns status as verified when all claims are supported', () => {
      const input: ProvenanceInput = {
        sources: [{ url: 'https://example.com/valid', title: 'Valid', sourceType: 'article', status: 'verified' }],
        claims: [
          { text: 'Claim with valid source', riskLevel: 'standard', sourceUrls: ['https://example.com/valid'], status: 'supported' },
        ],
      };
      const result = buildProvenance(input);
      expect(result.status).toBe('verified');
    });

    it('generates unique record references', () => {
      const input: ProvenanceInput = { sources: [], claims: [] };
      const r1 = buildProvenance(input);
      const r2 = buildProvenance(input);
      // Different object references
      expect(r1).not.toBe(r2);
      expect(r1.sources).not.toBe(r2.sources);
    });

    it('handles empty input gracefully', () => {
      const result = buildProvenance({ sources: [], claims: [] });
      expect(result.sources).toHaveLength(0);
      expect(result.claims).toHaveLength(0);
      expect(result.status).toBe('not_required');
    });
  });
});