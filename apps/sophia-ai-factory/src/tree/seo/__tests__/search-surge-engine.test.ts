/**
 * @file search-surge-engine.test.ts
 * @description Unit tests for Search-Surge SEO Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  detectSearchSurge,
  classifySearchIntent,
  generateSeoMetadata,
} from '../search-surge-engine';

describe('Search-Surge Engine', () => {
  it('detects a search spike with high Z-score above threshold', () => {
    const history = [
      { timestamp: 1000, velocity: 100 },
      { timestamp: 2000, velocity: 120 },
      { timestamp: 3000, velocity: 110 },
      { timestamp: 4000, velocity: 90 },
      { timestamp: 5000, velocity: 105 },
    ];
    // Baseline mean = 105, stdDev ~ 10.48. Current = 600 queries/hr -> Z-score ~ 47
    const result = detectSearchSurge('best ai video maker', history, 600, 2.5);

    expect(result.isSurging).toBe(true);
    expect(result.zScore).toBeGreaterThan(2.5);
    expect(result.intent).toBe('COMMERCIAL');
  });

  it('correctly flags normal velocity without surge', () => {
    const history = [
      { timestamp: 1000, velocity: 500 },
      { timestamp: 2000, velocity: 520 },
      { timestamp: 3000, velocity: 480 },
    ];
    const result = detectSearchSurge('ai tools overview', history, 510, 2.5);

    expect(result.isSurging).toBe(false);
    expect(result.zScore).toBeLessThan(2.5);
    expect(result.intent).toBe('INFORMATIONAL');
  });

  it('classifies search intent correctly', () => {
    expect(classifySearchIntent('how to create ai videos')).toBe('INFORMATIONAL');
    expect(classifySearchIntent('best video generator vs heygen')).toBe('COMMERCIAL');
    expect(classifySearchIntent('buy sophia ai discount coupon')).toBe('TRANSACTIONAL');
  });

  it('generates structured metadata with tags and chapters', () => {
    const meta = generateSeoMetadata('faceless youtube automation', 'INFORMATIONAL');
    expect(meta.title).toContain('faceless youtube automation');
    expect(meta.tags.length).toBeGreaterThanOrEqual(4);
    expect(meta.chapters.length).toBe(4);
    expect(meta.chapters[0].time).toBe('0:00');
  });
});
