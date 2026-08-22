import { extractClaims, extractVerifiableClaims, assessClaimRisk, type ClaimSource } from '../claim-extractor';

describe('claim-extractor', () => {
  const sources: ClaimSource[] = [
    { url: 'https://example.com/article1' },
    { url: 'https://example.com/article2' },
  ];

  describe('extractClaims', () => {
    it('extracts claims with text and risk level', () => {
      const raw = [{ text: 'Python is a programming language', riskLevel: 'standard' }];
      const result = extractClaims(raw, sources);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Python is a programming language');
      expect(result[0].riskLevel).toBe('standard');
      expect(result[0].sourceUrls).toEqual([]);
    });

    it('filters claims to allowed source URLs', () => {
      const raw = [{
        text: 'Python is popular',
        sourceUrls: ['https://example.com/article1', 'https://evil.com/'],
      }];
      const result = extractClaims(raw, sources);
      expect(result[0].sourceUrls).toEqual(['https://example.com/article1']);
    });

    it('handles claim key alias', () => {
      const raw = [{ claim: 'Test claim text' }];
      const result = extractClaims(raw, sources);
      expect(result[0].text).toBe('Test claim text');
    });

    it('caps at 25 claims', () => {
      const raw = Array.from({ length: 50 }, (_, i) => ({ text: `Claim ${i}` }));
      const result = extractClaims(raw, sources);
      expect(result.length).toBe(25);
    });

    it('filters empty claims', () => {
      const raw = [{ text: '' }, { text: 'Valid claim' }];
      const result = extractClaims(raw, sources);
      expect(result).toHaveLength(1);
    });

    it('assigns high risk level correctly', () => {
      const raw = [{ text: 'High risk claim', riskLevel: 'high' }];
      const result = extractClaims(raw, sources);
      expect(result[0].riskLevel).toBe('high');
    });

    it('defaults risk level to standard', () => {
      const raw = [{ text: 'Standard claim' }];
      const result = extractClaims(raw, sources);
      expect(result[0].riskLevel).toBe('standard');
    });

    it('deduplicates source URLs', () => {
      const raw = [{
        text: 'Test',
        sourceUrls: ['https://example.com/article1', 'https://example.com/article1'],
      }];
      const result = extractClaims(raw, sources);
      expect(result[0].sourceUrls).toHaveLength(1);
    });
  });

  describe('extractVerifiableClaims', () => {
    it('extracts claims with statistics', () => {
      const content = 'Python grew by 25% in 2024. This is a normal sentence without stats.';
      const claims = extractVerifiableClaims(content);
      expect(claims.length).toBe(1);
      expect(claims[0]).toContain('25%');
    });

    it('returns empty for no verifiable claims', () => {
      const claims = extractVerifiableClaims('This is a simple sentence.');
      expect(claims).toEqual([]);
    });

    it('extracts claims with dollar amounts', () => {
      const claims = extractVerifiableClaims('The company raised $5 million in funding.');
      expect(claims.length).toBeGreaterThan(0);
    });
  });

  describe('assessClaimRisk', () => {
    it('returns high risk for statistical claims without sources', () => {
      expect(assessClaimRisk('Growth reached 25% this year', false)).toBe('high');
    });

    it('returns standard for claims without sources', () => {
      expect(assessClaimRisk('Python is a programming language', false)).toBe('standard');
    });

    it('returns standard for high-risk claims with sources', () => {
      expect(assessClaimRisk('Growth reached 25% this year', true)).toBe('standard');
    });
  });
});