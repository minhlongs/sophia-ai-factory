import { describe, it, expect } from 'vitest';
import {
  encodePersonaArmKey,
  decodePersonaArmKey,
  buildPersonaArmSpec,
  toPersonaArmGender,
  toPersonaArmDialect,
} from '../persona-arm-codec';
import {
  selectOptimalPersonaGenderArm,
  type ThompsonHookArm,
  seededRandom,
} from '../thompson-sampling-optimizer';

describe('Video Gender 2027 Persona MAB Optimization', () => {
  describe('persona-arm-codec', () => {
    it('encodes and decodes a composite arm key reliably', () => {
      const spec = {
        hookAngle: 'contrarian-secret',
        personaGender: 'male' as const,
        voiceDialect: 'vi-TN-bac' as const,
      };

      const key = encodePersonaArmKey(spec);
      expect(key).toBe('contrarian-secret|male|vi-tn-bac');

      const decoded = decodePersonaArmKey(key);
      expect(decoded).toEqual({
        hookAngle: 'contrarian-secret',
        personaGender: 'male',
        voiceDialect: 'vi-tn-bac',
      });
    });

    it('returns null when decoding a malformed key', () => {
      expect(decodePersonaArmKey('invalid-key')).toBeNull();
      expect(decodePersonaArmKey('angle|other|dialect')).toBeNull();
    });

    it('maps regional dialects and genders accurately', () => {
      expect(toPersonaArmGender('male')).toBe('male');
      expect(toPersonaArmGender('female')).toBe('female');
      expect(toPersonaArmGender(undefined)).toBe('female');

      expect(toPersonaArmDialect('vi-VN-nam')).toBe('vi-TN-nam');
      expect(toPersonaArmDialect('vi-VN-trung')).toBe('vi-TN-trung');
      expect(toPersonaArmDialect('en-US')).toBe('en-US');
    });

    it('builds persona arm spec preferring demographics when no MAB override is given', () => {
      const spec = buildPersonaArmSpec({
        hookAngle: 'pain_point',
        dialect: 'vi-VN-bac',
        genders: { male: 0.8, female: 0.2 },
      });

      expect(spec.personaGender).toBe('male');
      expect(spec.voiceDialect).toBe('vi-TN-bac');
    });

    it('prioritizes mabPreferredGender when explicitly provided', () => {
      const spec = buildPersonaArmSpec({
        hookAngle: 'pain_point',
        dialect: 'vi-VN-bac',
        genders: { male: 0.8, female: 0.2 },
        mabPreferredGender: 'female',
      });

      expect(spec.personaGender).toBe('female');
    });
  });

  describe('selectOptimalPersonaGenderArm', () => {
    it('selects and decodes winning composite arm via Thompson Sampling', () => {
      const maleArmKey = encodePersonaArmKey({
        hookAngle: 'crypto-growth',
        personaGender: 'male',
        voiceDialect: 'vi-TN-bac',
      });
      const femaleArmKey = encodePersonaArmKey({
        hookAngle: 'crypto-growth',
        personaGender: 'female',
        voiceDialect: 'vi-TN-bac',
      });

      // Female arm has 10x higher conversion rate in this experiment
      const arms: ThompsonHookArm[] = [
        {
          id: maleArmKey,
          name: 'Crypto Growth (Male)',
          niche: 'crypto_global',
          impressions: 1000,
          conversions: 10, // 1% CVR
          totalRewardCents: 5000,
        },
        {
          id: femaleArmKey,
          name: 'Crypto Growth (Female)',
          niche: 'crypto_global',
          impressions: 1000,
          conversions: 100, // 10% CVR
          totalRewardCents: 50000,
        },
      ];

      // Run multiple trials with deterministic seeded RNG
      const rng = seededRandom(42);
      let femalePicks = 0;
      const trials = 100;

      for (let i = 0; i < trials; i++) {
        const choice = selectOptimalPersonaGenderArm(arms, rng);
        if (choice.personaGender === 'female') {
          femalePicks++;
        }
      }

      // Posterior for 10% CVR overwhelmingly beats 1% CVR
      expect(femalePicks).toBeGreaterThan(95);

      const singleChoice = selectOptimalPersonaGenderArm(arms, rng);
      expect(singleChoice.personaGender).toBe('female');
      expect(singleChoice.voiceDialect).toBe('vi-tn-bac');
      expect(singleChoice.hookAngle).toBe('crypto-growth');
    });
  });
});
