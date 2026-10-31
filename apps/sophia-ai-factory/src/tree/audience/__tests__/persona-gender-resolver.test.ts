import { describe, it, expect } from 'vitest';
import {
  resolveVideoPersona,
} from '../persona-gender-resolver';
import {
  demographicsAlignment,
  genderAlignment,
} from '../targeting-weights';
import type { AudienceMetrics, AudienceSegment } from '../types';

describe('Audience Demographics & Persona Resolver (Video Gender 2027)', () => {
  describe('genderAlignment & demographicsAlignment', () => {
    const baseSegment: AudienceSegment = {
      id: 'seg_1',
      workspaceId: 'ws_1',
      name: 'Crypto Tech Enthusiasts',
      platforms: ['youtube'],
      contentTypes: ['short_video'],
      ageBuckets: ['25-34', '35-44'],
      countries: ['US', 'VN'],
      createdAt: 1000,
      updatedAt: 1000,
      targetGenders: ['male'],
    };

    const metricsWithGenders: AudienceMetrics = {
      id: 'm_1',
      workspaceId: 'ws_1',
      platform: 'youtube',
      followers: 50_000,
      engagementRate: 0.05,
      demographics: {
        ageBuckets: { '25-34': 0.4, '35-44': 0.3 },
        genders: { male: 0.75, female: 0.25 },
      },
      windowStartMs: 0,
      windowEndMs: 1000,
      createdAt: 1000,
    };

    it('calculates genderAlignment accurately based on targetGenders', () => {
      const score = genderAlignment(baseSegment, metricsWithGenders);
      expect(score).toBe(0.75);
    });

    it('returns 0 when segment has no targetGenders', () => {
      const segWithoutGender: AudienceSegment = { ...baseSegment, targetGenders: undefined };
      expect(genderAlignment(segWithoutGender, metricsWithGenders)).toBe(0);
    });

    it('blends 60% age and 40% gender when both demographics exist', () => {
      // Age alignment: 0.4 + 0.3 = 0.7
      // Gender alignment: 0.75
      // Expected blended: 0.6 * 0.7 + 0.4 * 0.75 = 0.42 + 0.30 = 0.72
      const blended = demographicsAlignment(baseSegment, metricsWithGenders);
      expect(blended).toBeCloseTo(0.72, 5);
    });

    it('falls back to 100% age alignment when metrics have no gender data', () => {
      const metricsNoGender: AudienceMetrics = {
        ...metricsWithGenders,
        demographics: {
          ageBuckets: { '25-34': 0.4, '35-44': 0.3 },
        },
      };
      const score = demographicsAlignment(baseSegment, metricsNoGender);
      expect(score).toBeCloseTo(0.7, 5);
    });
  });

  describe('resolveVideoPersona', () => {
    it('resolves male technical analyst for crypto niche with dominant male audience', () => {
      const persona = resolveVideoPersona({
        niche: 'crypto_global',
        genders: { male: 0.72, female: 0.28 },
      });

      expect(persona.gender).toBe('male');
      expect(persona.avatarStyle).toBe('technical_analyst');
      expect(persona.voiceProfile).toBeDefined();
      expect(persona.voiceProfile.gender).toBe('male');
      expect(persona.explanation).toContain('skew male');
    });

    it('resolves female energetic reviewer for VN ecommerce niche', () => {
      const persona = resolveVideoPersona({
        niche: 'ecommerce_vn',
        dialect: 'vi-VN-bac',
        genders: { female: 0.68, male: 0.32 },
      });

      expect(persona.gender).toBe('female');
      expect(persona.avatarStyle).toBe('energetic_reviewer');
      expect(persona.voiceProfile.dialect).toBe('vi-VN-bac');
      expect(persona.explanation).toContain('skew female');
    });

    it('prioritizes MAB preferred gender during exploitation phase', () => {
      const persona = resolveVideoPersona({
        niche: 'crypto_global',
        genders: { male: 0.7, female: 0.3 },
        mabPreferredGender: 'female', // MAB found female persona yields higher EPC
      });

      expect(persona.gender).toBe('female');
      expect(persona.voiceProfile.gender).toBe('female');
      expect(persona.explanation).toContain('MAB optimization converged to female');
    });

    it('falls back gracefully to domain baseline when demographics are missing', () => {
      const persona = resolveVideoPersona({
        niche: 'saas_global',
      });

      expect(persona.gender).toBe('female');
      expect(persona.avatarStyle).toBe('executive_expert');
      expect(persona.voiceProfile).toBeDefined();
    });
  });
});
