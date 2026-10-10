import { describe, it, expect } from 'vitest';
import {
  VIDEO_GENERATION_SOPS,
  facelessYoutubeCashCow,
  tiktokCreativityProgram,
  youtubeShortsMonetization,
} from '../index';

describe('SOP Video Generation Definitions', () => {
  it('exports all 3 standard video SOPs in VIDEO_GENERATION_SOPS', () => {
    expect(VIDEO_GENERATION_SOPS).toHaveLength(3);
    expect(VIDEO_GENERATION_SOPS.map((s) => s.slug)).toEqual([
      'faceless-youtube-cash-cow',
      'tiktok-creativity-program',
      'youtube-shorts-monetization',
    ]);
  });

  it('validates Faceless YouTube Cash Cow structure and steps', () => {
    expect(facelessYoutubeCashCow.slug).toBe('faceless-youtube-cash-cow');
    expect(facelessYoutubeCashCow.steps.length).toBeGreaterThanOrEqual(6);
    expect(facelessYoutubeCashCow.steps[0].order).toBe(1);
    expect(facelessYoutubeCashCow.steps[0].tool).toBe('keyword-research');
  });

  it('validates TikTok Creativity Program structure and steps', () => {
    expect(tiktokCreativityProgram.slug).toBe('tiktok-creativity-program');
    expect(tiktokCreativityProgram.steps.length).toBeGreaterThanOrEqual(5);
    expect(tiktokCreativityProgram.steps[0].order).toBe(1);
    expect(tiktokCreativityProgram.steps[0].tool).toBe('tiktok-trends');
  });

  it('validates YouTube Shorts Monetization structure and steps', () => {
    expect(youtubeShortsMonetization.slug).toBe('youtube-shorts-monetization');
    expect(youtubeShortsMonetization.steps.length).toBeGreaterThanOrEqual(5);
    expect(youtubeShortsMonetization.steps[0].order).toBe(1);
    expect(youtubeShortsMonetization.steps[0].tool).toBe('trend-research');
  });
});
