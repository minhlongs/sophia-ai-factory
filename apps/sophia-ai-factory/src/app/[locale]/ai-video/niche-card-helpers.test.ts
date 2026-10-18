import { describe, expect, it } from 'vitest';
import { getNicheCard, nicheEmoji } from './niche-card-helpers';

describe('AI video niche card helpers', () => {
  it('uses the requested Vietnamese or English label for known niches', () => {
    expect(getNicheCard('real-estate', true)).toEqual({
      name: 'Bất Động Sản',
      emoji: '🏠',
      slug: 'real-estate',
    });
    expect(getNicheCard('real-estate', false).name).toBe('Real Estate');
  });

  it('falls back to a readable label and default emoji for unknown niches', () => {
    expect(getNicheCard('new-niche', false)).toEqual({
      name: 'new niche',
      emoji: '🎬',
      slug: 'new-niche',
    });
    expect(nicheEmoji('unknown')).toBe('🎬');
  });

  it('maps a known niche to its configured emoji', () => {
    expect(nicheEmoji('crypto')).toBe('💰');
  });
});
