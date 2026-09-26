/** @vitest-environment node */

/**
 * Unit Test Suite: AI Virality & Hook Quality Scorer
 *
 * Validates:
 * 1. 4-Dimension scoring:
 *    - Hook Strength (0-30): Pacing, style weighting, viral power words
 *    - Storyboard Coherence (0-25): Scene density, prompt detail, 9:16 ratio
 *    - Script Cadence (0-25): WPM speaking rate, CTA presence, open loops
 *    - Niche Fit (0-20): Parameter tokens ({{...}}), high-commercial niche bonus
 * 2. Decision thresholds:
 *    - Q >= 75 -> 'approved'
 *    - 40 <= Q < 75 -> 'pending'
 *    - Q < 40 -> 'rejected'
 * 3. Validation: Throws error when scriptTemplate is empty or whitespace
 * 4. Actionable feedback generation across deficit dimensions
 *
 * @module tree/marketplace/__tests__/quality-scorer.test
 */

import { describe, it, expect } from 'vitest';
import { scoreTemplateQuality } from '../quality-scorer';
import type { TemplateEvaluationInput } from '../types';

describe('AI Virality & Hook Quality Scorer — Unit Tests', () => {
  describe('Input Validation', () => {
    it('throws validation error when scriptTemplate is empty', () => {
      expect(() => {
        scoreTemplateQuality({
          title: 'Empty Script',
          scriptTemplate: '',
        });
      }).toThrowError(/scriptTemplate must not be empty/);
    });

    it('throws validation error when scriptTemplate is only whitespace', () => {
      expect(() => {
        scoreTemplateQuality({
          title: 'Whitespace Script',
          scriptTemplate: '   \n\t   ',
        });
      }).toThrowError(/scriptTemplate must not be empty/);
    });
  });

  describe('Auto-Approval Threshold (Q >= 75 -> approved)', () => {
    it('evaluates high-virality SaaS template and auto-approves with score >= 75', () => {
      const highQualityInput: TemplateEvaluationInput = {
        title: '3 Proven SaaS Secrets That Scaled Us To $100k',
        scriptTemplate:
          'Stop making this deadly mistake with your {{product_name}}! ' +
          'The shocking secret revealed today helped {{target_niche}} founders unlock 10x pipeline growth. ' +
          'Here is why most founders fail: they burn cash on paid ads, but nobody talks about organic loops. ' +
          'However, when you implement automated referral triggers, conversion explodes overnight. ' +
          'Comment "GROWTH" below or click the link in bio to try now!',
        hookStyle: 'curiosity_gap',
        aspectRatio: '9:16',
        niche: 'saas',
        targetPlatform: 'tiktok',
        visualStylePrompt: 'Cinematic hyper-realistic modern tech office with volumetric lighting and floating UI hologram',
        storyboardJson: JSON.stringify([
          {
            sceneNumber: 1,
            visualPrompt: 'Close up dramatic shot of founder staring at crashing analytics dashboard in dark room with blue neon backlight',
            voiceoverScript: 'Stop making this deadly mistake with your {{product_name}}!',
            durationSeconds: 5,
          },
          {
            sceneNumber: 2,
            visualPrompt: 'Sudden dynamic transition to exponential green graph rising up through modern glass office desk in 4k detail',
            voiceoverScript: 'The shocking secret revealed today helped {{target_niche}} founders unlock 10x pipeline growth.',
            durationSeconds: 7,
          },
          {
            sceneNumber: 3,
            visualPrompt: 'Split screen comparing burned paper money with automated high tech server racks pulsing with data streams',
            voiceoverScript: 'Here is why most founders fail: they burn cash on paid ads, but nobody talks about organic loops.',
            durationSeconds: 8,
          },
          {
            sceneNumber: 4,
            visualPrompt: 'Cinematic handheld view of customer notifications flooding a smartphone screen with instant cash payment alerts',
            voiceoverScript: 'However, when you implement automated referral triggers, conversion explodes overnight.',
            durationSeconds: 6,
          },
          {
            sceneNumber: 5,
            visualPrompt: 'Bold typography animation saying COMMENT GROWTH NOW with glowing neon call to action button pulsing',
            voiceoverScript: 'Comment "GROWTH" below or click the link in bio to try now!',
            durationSeconds: 4,
          },
        ]),
        estimatedDurationSeconds: 30,
      };

      const result = scoreTemplateQuality(highQualityInput);

      expect(result.totalScore).toBeGreaterThanOrEqual(75);
      expect(result.status).toBe('approved');
      expect(result.dimensions.hookStrength.score).toBeGreaterThanOrEqual(25);
      expect(result.dimensions.storyboardCoherence.score).toBeGreaterThanOrEqual(20);
      expect(result.dimensions.scriptCadence.score).toBeGreaterThanOrEqual(20);
      expect(result.dimensions.nicheFit.score).toBe(20); // 10 (tokens) + 10 (SaaS niche)
    });
  });

  describe('Pending Review Queue Threshold (40 <= Q < 75 -> pending)', () => {
    it('routes moderately scored template to pending status', () => {
      const moderateInput: TemplateEvaluationInput = {
        title: 'Simple Daily Habit Review',
        scriptTemplate:
          'This is a simple daily habit for {{niche}} enthusiasts. ' +
          'It takes five minutes every morning and helps you stay focused during your work hours. ' +
          'Check out our profile if you want more tips like this.',
        hookStyle: 'relatable_pain',
        aspectRatio: '16:9', // non-vertical
        niche: 'fitness', // non-commercial
        storyboardJson: JSON.stringify([
          {
            sceneNumber: 1,
            visualPrompt: 'A person holding a coffee cup in a brightly lit kitchen',
            durationSeconds: 15,
          },
          {
            sceneNumber: 2,
            visualPrompt: 'Desk setup with notebook and pen',
            durationSeconds: 15,
          },
        ]),
      };

      const result = scoreTemplateQuality(moderateInput);

      expect(result.totalScore).toBeGreaterThanOrEqual(40);
      expect(result.totalScore).toBeLessThan(75);
      expect(result.status).toBe('pending');
      expect(result.feedback.length).toBeGreaterThan(0);
    });
  });

  describe('Rejection Threshold (Q < 40 -> rejected)', () => {
    it('rejects low-quality template with severe deficits and generates actionable feedback', () => {
      const lowQualityInput: TemplateEvaluationInput = {
        title: 'Bad Video',
        scriptTemplate: 'Hello world.', // 2 words, no hook, no CTA, no variables, no viral words
        hookStyle: 'unknown_style',
        aspectRatio: 'invalid_aspect',
        niche: 'misc',
        storyboardJson: '[]', // 0 scenes
      };

      const result = scoreTemplateQuality(lowQualityInput);

      expect(result.totalScore).toBeLessThan(40);
      expect(result.status).toBe('rejected');
      expect(result.feedback).toContain('Missing storyboard scenes: Please provide at least 4 structured scenes.');
      expect(result.feedback).toContain('Missing Call-To-Action (CTA): Add an explicit closing prompt (e.g., "link in bio", "comment below").');
      expect(result.feedback).toContain('No customizable template variables found. Use {{variable_name}} so remixers can personalize it.');
    });
  });

  describe('Dimension 1: Hook Strength (0-30)', () => {
    it('awards full 10 points for opening sentence between 5 and 12 words', () => {
      const res = scoreTemplateQuality({
        title: 'Hook Test',
        scriptTemplate:
          'Stop making this costly mistake right now! ' +
          '{{variable_one}} and {{variable_two}} will change everything. ' +
          'Comment below to try now.',
        hookStyle: 'curiosity_gap',
        niche: 'tech',
      });

      expect(res.dimensions.hookStrength.details.pacingScore).toBe(10);
    });

    it('penalizes overly long opening sentence (> 16 words)', () => {
      const res = scoreTemplateQuality({
        title: 'Long Hook Test',
        scriptTemplate:
          'In this video today we are going to talk about a very long and complicated topic that nobody really understands until they see it clearly. ' +
          '{{variable_one}} and {{variable_two}}. ' +
          'Click the link in bio.',
        hookStyle: 'curiosity_gap',
      });

      expect(res.dimensions.hookStrength.details.pacingScore).toBe(4);
    });

    it('multiplies score for high-CTR styles (curiosity_gap, pattern_interrupt)', () => {
      const resCuriosity = scoreTemplateQuality({
        title: 'Curiosity Test',
        scriptTemplate: 'Did you know about this secret? {{var1}} {{var2}}. Comment below.',
        hookStyle: 'curiosity_gap',
      });
      const resGeneric = scoreTemplateQuality({
        title: 'Generic Test',
        scriptTemplate: 'Did you know about this secret? {{var1}} {{var2}}. Comment below.',
        hookStyle: 'some_generic_style',
      });

      expect(resCuriosity.dimensions.hookStrength.details.styleScore).toBe(10);
      expect(resGeneric.dimensions.hookStrength.details.styleScore).toBe(7);
    });

    it('accumulates viral power word points up to 10 maximum', () => {
      const res = scoreTemplateQuality({
        title: 'Viral Words Test',
        scriptTemplate:
          'Stop! This shocking secret mistake was revealed and proven today. ' +
          'Never avoid this hack. {{v1}} {{v2}}. Link in bio.',
      });

      expect(res.dimensions.hookStrength.details.viralWordsMatched).toBeGreaterThanOrEqual(4);
      expect(res.dimensions.hookStrength.details.viralScore).toBe(10);
    });
  });

  describe('Dimension 2: Storyboard Coherence (0-25)', () => {
    it('awards 10 points for optimal scene count between 4 and 8 scenes', () => {
      const scenes = [
        { sceneNumber: 1, visualPrompt: 'Detailed scene prompt with more than fifteen words describing the actor in the studio setting', durationSeconds: 5 },
        { sceneNumber: 2, visualPrompt: 'Detailed scene prompt with more than fifteen words describing the actor in the studio setting', durationSeconds: 5 },
        { sceneNumber: 3, visualPrompt: 'Detailed scene prompt with more than fifteen words describing the actor in the studio setting', durationSeconds: 5 },
        { sceneNumber: 4, visualPrompt: 'Detailed scene prompt with more than fifteen words describing the actor in the studio setting', durationSeconds: 5 },
      ];

      const res = scoreTemplateQuality({
        title: 'Storyboard Test',
        scriptTemplate: 'Stop this secret mistake! {{var1}} {{var2}}. Comment below.',
        aspectRatio: '9:16',
        storyboardJson: JSON.stringify(scenes),
      });

      expect(res.dimensions.storyboardCoherence.details.sceneCountScore).toBe(10);
      expect(res.dimensions.storyboardCoherence.details.aspectScore).toBe(5);
      expect(res.dimensions.storyboardCoherence.details.promptScore).toBe(10);
      expect(res.dimensions.storyboardCoherence.score).toBe(25);
    });

    it('handles non-JSON or array format in storyboardJson gracefully', () => {
      const res = scoreTemplateQuality({
        title: 'Array Storyboard Test',
        scriptTemplate: 'Stop this secret mistake! {{var1}} {{var2}}. Comment below.',
        storyboardJson: [
          { visualPrompt: 'Scene one visual with high descriptive density', durationSeconds: 5 },
          { visualPrompt: 'Scene two visual with high descriptive density', durationSeconds: 5 },
        ],
      });

      expect(res.dimensions.storyboardCoherence.details.sceneCount).toBe(2);
      expect(res.dimensions.storyboardCoherence.details.sceneCountScore).toBe(6);
    });
  });

  describe('Dimension 3: Script Cadence (0-25)', () => {
    it('scores WPM in optimal range (130-165 WPM)', () => {
      // 30 seconds duration -> 0.5 minutes. Target words: 65 - 82 words
      const words = Array(72).fill('word').join(' ');
      const script = `${words} secret mistake stop! {{var1}} {{var2}} click link in bio.`;

      const res = scoreTemplateQuality({
        title: 'WPM Test',
        scriptTemplate: script,
        estimatedDurationSeconds: 30,
      });

      expect(res.dimensions.scriptCadence.details.wpmScore).toBe(10);
    });

    it('detects CTA presence in script', () => {
      const resWithCta = scoreTemplateQuality({
        title: 'CTA Test',
        scriptTemplate: 'Stop making this secret mistake! {{v1}} {{v2}}. Comment below to get it.',
      });
      const resNoCta = scoreTemplateQuality({
        title: 'No CTA Test',
        scriptTemplate: 'Stop making this secret mistake! {{v1}} {{v2}}. The end of the video.',
      });

      expect(resWithCta.dimensions.scriptCadence.details.matchedCta).toBe(true);
      expect(resWithCta.dimensions.scriptCadence.details.ctaScore).toBe(10);
      expect(resNoCta.dimensions.scriptCadence.details.matchedCta).toBe(false);
      expect(resNoCta.dimensions.scriptCadence.details.ctaScore).toBe(0);
    });
  });

  describe('Dimension 4: Niche Fit & Modularity (0-20)', () => {
    it('awards 10 points for 2 or more template variables and 10 points for commercial niches', () => {
      const res = scoreTemplateQuality({
        title: 'Niche Fit Test',
        scriptTemplate: 'Stop! The secret for {{company_name}} in {{target_industry}} is here! Comment below.',
        niche: 'finance',
      });

      expect(res.dimensions.nicheFit.details.uniqueTokensCount).toBe(2);
      expect(res.dimensions.nicheFit.details.tokenScore).toBe(10);
      expect(res.dimensions.nicheFit.details.isCommercial).toBe(true);
      expect(res.dimensions.nicheFit.details.nicheScore).toBe(10);
      expect(res.dimensions.nicheFit.score).toBe(20);
    });

    it('awards 5 points for 1 variable and 5 points for non-commercial niche', () => {
      const res = scoreTemplateQuality({
        title: 'Single Var Test',
        scriptTemplate: 'Stop! The secret for {{user_name}} is here! Comment below.',
        niche: 'gardening',
      });

      expect(res.dimensions.nicheFit.details.uniqueTokensCount).toBe(1);
      expect(res.dimensions.nicheFit.details.tokenScore).toBe(5);
      expect(res.dimensions.nicheFit.details.isCommercial).toBe(false);
      expect(res.dimensions.nicheFit.details.nicheScore).toBe(5);
      expect(res.dimensions.nicheFit.score).toBe(10);
    });
  });
});
