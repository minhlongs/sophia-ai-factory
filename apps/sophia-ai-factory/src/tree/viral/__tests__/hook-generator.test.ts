import { describe, it, expect } from 'vitest';
import {
  generateViralHooks,
  findTrendingHooks,
  generateViralScript,
  buildFunnelCta,
} from '../hook-generator';
import {
  NICHE_PROFILES,
  ARCHETYPE_DEFINITIONS,
  DETERMINISTIC_HOOK_VAULT,
} from '../hook-prompts';
import type { ViralNiche, HookArchetype } from '@/seed/types/growth';

describe('Viral Hook Generator (Tree Layer)', () => {
  const niches: ViralNiche[] = ['ai_automation', 'ecommerce', 'solopreneur'];
  const archetypes: HookArchetype[] = [
    'curiosity_gap',
    'shock_stat',
    'direct_question',
    'problem_solution',
    'contrarian',
  ];

  describe('Niche Profiles & Archetypes Verification', () => {
    it('provides comprehensive profiles for all 3 target niches', () => {
      niches.forEach((niche) => {
        const profile = NICHE_PROFILES[niche];
        expect(profile).toBeDefined();
        expect(profile.name).toBeTruthy();
        expect(profile.nameVi).toBeTruthy();
        expect(profile.primaryPains.length).toBeGreaterThan(0);
        expect(profile.primaryPainsVi.length).toBeGreaterThan(0);
        expect(profile.desires.length).toBeGreaterThan(0);
        expect(profile.desiresVi.length).toBeGreaterThan(0);
        expect(profile.recommendedKeywords.length).toBeGreaterThan(0);
      });
    });

    it('provides psychological definitions for all 5 hook archetypes', () => {
      archetypes.forEach((arch) => {
        const def = ARCHETYPE_DEFINITIONS[arch];
        expect(def).toBeDefined();
        expect(def.name).toBeTruthy();
        expect(def.nameVi).toBeTruthy();
        expect(def.psychologicalMechanism).toBeTruthy();
        expect(def.idealDurationSec).toBeGreaterThanOrEqual(3);
      });
    });

    it('contains deterministic vault entries covering all 15 niche-archetype combinations', () => {
      niches.forEach((niche) => {
        archetypes.forEach((arch) => {
          const found = DETERMINISTIC_HOOK_VAULT.find(
            (h) => h.niche === niche && h.archetype === arch,
          );
          expect(found).toBeDefined();
          expect(found?.hookText).toBeTruthy();
          expect(found?.hookTextVi).toBeTruthy();
          expect(found?.expectedRetentionScore).toBeGreaterThan(80);
        });
      });
    });
  });

  describe('generateViralHooks', () => {
    it('generates hooks for AI Automation niche', async () => {
      const hooks = await generateViralHooks({ niche: 'ai_automation', count: 5 });
      expect(hooks.length).toBe(5);
      hooks.forEach((h) => {
        expect(h.niche).toBe('ai_automation');
        expect(h.hookText).toBeTruthy();
        expect(h.hookTextVi).toBeTruthy();
        expect(h.expectedRetentionScore).toBeGreaterThan(0);
      });
    });

    it('filters hooks by specific archetype: contrarian', async () => {
      const hooks = await generateViralHooks({
        niche: 'solopreneur',
        archetype: 'contrarian',
        count: 1,
      });
      expect(hooks.length).toBe(1);
      expect(hooks[0].archetype).toBe('contrarian');
      expect(hooks[0].niche).toBe('solopreneur');
      expect(hooks[0].hookText).toContain('team of 10');
    });

    it('generates custom topic hooks dynamically when customTopic is supplied', async () => {
      const topic = 'TikTok Affiliate Scaling';
      const hooks = await generateViralHooks({
        niche: 'ecommerce',
        customTopic: topic,
        count: 3,
      });
      expect(hooks.length).toBe(3);
      hooks.forEach((h) => {
        expect(h.niche).toBe('ecommerce');
        expect(h.hookText.toLowerCase()).toContain(topic.toLowerCase());
        expect(h.hookTextVi.toLowerCase()).toContain(topic.toLowerCase());
      });
    });
  });

  describe('findTrendingHooks', () => {
    it('ranks trending hooks by viralVelocityScore in descending order', () => {
      const trending = findTrendingHooks({ minVelocity: 70, limit: 10 });
      expect(trending.length).toBeGreaterThan(0);
      expect(trending.length).toBeLessThanOrEqual(10);

      for (let i = 0; i < trending.length - 1; i++) {
        expect(trending[i].viralVelocityScore).toBeGreaterThanOrEqual(
          trending[i + 1].viralVelocityScore,
        );
      }
    });

    it('includes suggested B-roll and historical CTR metrics', () => {
      const trending = findTrendingHooks({ niche: 'ai_automation', limit: 3 });
      expect(trending.length).toBeGreaterThan(0);
      trending.forEach((item) => {
        expect(item.suggestedBroll).toBeTruthy();
        expect(item.historicalCtrPct).toBeGreaterThan(0);
        expect(item.nicheRelevance).toBeGreaterThanOrEqual(90);
      });
    });
  });

  describe('buildFunnelCta', () => {
    it('builds referral URLs and Telegram deep-links with custom params', () => {
      const cta = buildFunnelCta('solopreneur', 'AFF_999', 'vid_123_custom');
      expect(cta.ctaText).toBeTruthy();
      expect(cta.ctaTextVi).toBeTruthy();
      expect(cta.actionUrl).toContain('ref=AFF_999');
      expect(cta.actionUrl).toContain('utm_campaign=solopreneur');
      expect(cta.deepLink).toBe('https://t.me/Sophia_Bbot?start=vid_123_custom');
    });
  });

  describe('generateViralScript', () => {
    it('generates a complete 30s video script with all essential sections', async () => {
      const script = await generateViralScript({
        niche: 'ai_automation',
        targetDurationSec: 30,
        referralCode: 'PARTNER123',
      });

      expect(script).toBeDefined();
      expect(script.niche).toBe('ai_automation');
      expect(script.targetDurationSec).toBe(30);
      expect(script.sections.length).toBe(5);

      const sectionTypes = script.sections.map((s: { section: string }) => s.section);
      expect(sectionTypes).toEqual(['hook', 'problem', 'solution', 'proof', 'cta']);

      // Sum of section durations should approximate target duration
      const totalDuration = script.sections.reduce(
        (acc: number, s: { durationSec: number }) => acc + s.durationSec,
        0,
      );
      expect(totalDuration).toBeGreaterThanOrEqual(25);
      expect(totalDuration).toBeLessThanOrEqual(35);

      expect(script.ctaActionUrl).toContain('ref=PARTNER123');
      expect(script.telegramDeepLink).toContain('https://t.me/Sophia_Bbot');
      expect(script.hashtags.length).toBeGreaterThan(0);
    });

    it('adapts section timings when target duration is 15 seconds', async () => {
      const script = await generateViralScript({
        niche: 'ecommerce',
        targetDurationSec: 15,
      });

      expect(script.targetDurationSec).toBe(15);
      const totalDuration = script.sections.reduce(
        (acc: number, s: { durationSec: number }) => acc + s.durationSec,
        0,
      );
      expect(totalDuration).toBeGreaterThanOrEqual(12);
      expect(totalDuration).toBeLessThanOrEqual(18);
    });

    it('handles custom topic script synthesis smoothly', async () => {
      const script = await generateViralScript({
        niche: 'solopreneur',
        customTopic: 'Faceless YouTube Automation',
        targetDurationSec: 60,
      });

      expect(script.title).toBeTruthy();
      expect(script.titleVi).toBeTruthy();
      expect(
        script.sections.some((s: { narration: string }) =>
          s.narration.includes('Faceless YouTube Automation'),
        ),
      ).toBe(true);
    });
  });
});
