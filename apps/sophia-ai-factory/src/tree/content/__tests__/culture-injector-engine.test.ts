import { describe, it, expect } from 'vitest';
import { calculateCulturalAlignmentIndex, DialectDictionary } from '../culture-injector-engine';

describe('culture-injector-engine', () => {
  const dictionary: DialectDictionary = {
    'yall': 1.0,
    'howdy': 1.5,
    'reckon': 1.0,
    'fixin': 1.2
  };

  it('should return 0 for empty or whitespace text', () => {
    expect(calculateCulturalAlignmentIndex('', dictionary)).toBe(0);
    expect(calculateCulturalAlignmentIndex('   ', dictionary)).toBe(0);
    expect(calculateCulturalAlignmentIndex('123', dictionary)).toBe(0);
  });

  it('should return 0 if no cultural words match', () => {
    const text = "Hello everyone, how are you doing today in the city?";
    expect(calculateCulturalAlignmentIndex(text, dictionary)).toBe(0);
  });

  it('should return a valid CAI for normal usage', () => {
    // 10 words total, "yall" and "fixin" are in it.
    // Score = 1.0 + 1.2 = 2.2
    // Raw Density = 2.2 / 10 = 0.22
    // targetDensity = 0.1
    // Index = 0.22 / 0.1 = 2.2 (which is > 1.5, penalizes)
    const text = "Hey yall I am fixin to go to the store";
    const cai = calculateCulturalAlignmentIndex(text, dictionary, 0.1);

    // index is 2.2 => excess 0.7 => 1.0 - (0.7 * 0.5) = 0.65
    expect(cai).toBeCloseTo(0.65);
  });

  it('should cap at 1.0 for optimal usage', () => {
    // 10 words, just "yall"
    // Score = 1.0
    // Density = 0.1
    // targetDensity = 0.1
    // Index = 1.0
    const text = "Hey yall, I am going to the store right now";
    const cai = calculateCulturalAlignmentIndex(text, dictionary, 0.1);
    expect(cai).toBeCloseTo(1.0);
  });

  it('should handle case insensitivity and punctuation', () => {
    const text = "HOWDY! I reckon...";
    // 3 words: howdy, i, reckon
    // Score = 1.5 + 1.0 = 2.5
    // Density = 2.5 / 3 = ~0.833
    // target = 0.1 -> index = 8.33 -> highly penalized
    const cai = calculateCulturalAlignmentIndex(text, dictionary, 0.1);
    expect(cai).toBeLessThan(1.0);
  });
});
