import { describe, expect, it } from 'vitest';
import { buildAudioMixSpec } from '../audio-mixer-builder';
import { getBgmForNiche } from '../bgm-library';
import { generateSFXCues } from '../sfx-cue-generator';

describe('Audio Engine & SFX Cue Generator', () => {
  it('selects appropriate BGM tracks for niches', () => {
    const saasBgm = getBgmForNiche('saas_global');
    const cryptoBgm = getBgmForNiche('crypto_global');

    expect(saasBgm.id).toBeDefined();
    expect(cryptoBgm.id).toBeDefined();
    expect(saasBgm.bpm).toBeGreaterThan(100);
  });

  it('generates whoosh and cha-ching SFX cues from keywords and cuts', () => {
    const sfxCues = generateSFXCues({
      totalDurationSeconds: 15.0,
      scriptText: 'Never miss a massive money payout with this trading secret.',
      cutTimestamps: [3.0, 6.0, 9.0, 12.0],
      hasAffiliateCallout: true,
    });

    expect(sfxCues.length).toBeGreaterThanOrEqual(4);
    expect(sfxCues[0].type).toBe('whoosh_fast');
    const types = sfxCues.map((s) => s.type);
    expect(types).toContain('whoosh_deep');
    expect(types).toContain('cha_ching');
  });

  it('builds complete audio mix specification with ducking keyframes', () => {
    const sfxCues = generateSFXCues({
      totalDurationSeconds: 20.0,
      scriptText: 'Automate your SaaS analytics dashboard workflow.',
      cutTimestamps: [4.0, 8.0, 12.0, 16.0],
    });

    const mixSpec = buildAudioMixSpec({
      niche: 'saas_global',
      totalDurationSeconds: 20.0,
      sfxCues,
      hasVoiceover: true,
    });

    expect(mixSpec.duckingKeyframes.length).toBeGreaterThanOrEqual(4);
    expect(mixSpec.bgmVolumeDb).toBe(-18.0);
    expect(mixSpec.sfxCues.length).toBe(sfxCues.length);
  });
});
