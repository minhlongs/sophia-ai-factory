import { describe, it, expect } from 'vitest';
import { calculateCulturalAlignmentIndex, CulturalDictionary } from '../cultural-alignment.engine';

describe('Cultural Alignment Engine', () => {
  it('calculates perfect alignment when all keywords and idioms match', () => {
    const dict: CulturalDictionary = {
      region: 'SOUTHEAST_ASIA',
      keywords: ['viral', 'deal'],
      idioms: ['flash sale today'],
    };

    const text = 'Here is a viral deal on our flash sale today!';
    const result = calculateCulturalAlignmentIndex(text, dict);

    expect(result.alignmentScore).toBe(1.0);
    expect(result.matchedKeywords).toContain('viral');
    expect(result.matchedKeywords).toContain('deal');
    expect(result.matchedIdioms).toContain('flash sale today');
  });

  it('calculates partial alignment correctly', () => {
    const dict: CulturalDictionary = {
      region: 'NORTH_AMERICA',
      keywords: ['awesome', 'insane', 'grab'],
      idioms: ['out of this world'],
    };

    const text = 'This is awesome, definitely grab one!';
    const result = calculateCulturalAlignmentIndex(text, dict);

    // 2 out of 4 total possible matches (awesome, grab)
    expect(result.alignmentScore).toBe(0.5);
    expect(result.matchedKeywords).toEqual(['awesome', 'grab']);
    expect(result.matchedIdioms).toEqual([]);
  });

  it('handles empty inputs safely', () => {
    const dict: CulturalDictionary = { region: 'NONE', keywords: [], idioms: [] };
    const result = calculateCulturalAlignmentIndex('test', dict);
    expect(result.alignmentScore).toBe(0);
  });
});
