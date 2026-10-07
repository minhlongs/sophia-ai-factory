/**
 * Niche Script Prompt Builders & Storyboard Generator Vitest Suite
 *
 * Verifies SaaS and Crypto LLM prompt generation, bilingual adaptation,
 * and deterministic storyboard scene millisecond alignment.
 *
 * @module tree/video/prompts/__tests__/niche-script-prompts.test
 */

import { describe, it, expect } from 'vitest';
import { getBlueprintById } from '@/seed/config/video-blueprints';
import { buildSaasScriptPrompt } from '@/tree/video/prompts/saas-script-prompt-builder';
import { buildCryptoScriptPrompt } from '@/tree/video/prompts/crypto-script-prompt-builder';
import { generateStoryboardFromBlueprint } from '@/tree/video/prompts/storyboard-generator';

describe('Niche Script Prompt Builders', () => {
  const saasBlueprint = getBlueprintById('saas_problem_agitation_solution')!;
  const cryptoBlueprint = getBlueprintById('crypto_fee_discount_signup_bonus')!;

  describe('buildSaasScriptPrompt', () => {
    it('builds comprehensive system and user prompts with product details in English', () => {
      const prompts = buildSaasScriptPrompt({
        productName: 'FlowCraft AI',
        targetAudience: 'Agency Founders',
        blueprint: saasBlueprint,
        vanityCoupon: 'AGENCY30',
        locale: 'en',
      });

      expect(prompts.systemPrompt).toContain('Global B2B/SaaS software');
      expect(prompts.systemPrompt).toContain('Output language: English');
      expect(prompts.userPrompt).toContain('FlowCraft AI');
      expect(prompts.userPrompt).toContain('Agency Founders');
      expect(prompts.userPrompt).toContain('AGENCY30');
      expect(prompts.userPrompt).toContain('hookLine');
      expect(prompts.userPrompt).toContain('pinnedCommentText');
    });

    it('adapts language instruction for Vietnamese locale', () => {
      const prompts = buildSaasScriptPrompt({
        productName: 'FlowCraft AI',
        blueprint: saasBlueprint,
        locale: 'vi',
      });

      expect(prompts.systemPrompt).toContain('Output language: Vietnamese');
      expect(prompts.userPrompt).toContain('FlowCraft AI');
    });
  });

  describe('buildCryptoScriptPrompt', () => {
    it('enforces CFTC/FTC compliance instructions, 15s end-card, and referral code', () => {
      const prompts = buildCryptoScriptPrompt({
        exchangeName: 'Binance',
        targetAudience: 'Active Day Traders',
        referralCode: 'SOPHIA_VIP',
        blueprint: cryptoBlueprint,
        locale: 'en',
      });

      expect(prompts.systemPrompt).toContain('CFTC 4.41');
      expect(prompts.systemPrompt).toContain('FTC 16 C.F.R. § 255');
      expect(prompts.systemPrompt).toContain('FINAL 15 SECONDS');
      expect(prompts.userPrompt).toContain('Binance');
      expect(prompts.userPrompt).toContain('SOPHIA_VIP');
      expect(prompts.userPrompt).toContain('Active Day Traders');
    });

    it('instructs Vietnamese regulatory language when locale is vi', () => {
      const prompts = buildCryptoScriptPrompt({
        exchangeName: 'Bybit',
        blueprint: cryptoBlueprint,
        locale: 'vi',
      });

      expect(prompts.systemPrompt).toContain('Output language: Vietnamese');
      expect(prompts.userPrompt).toContain('Bybit');
    });
  });

  describe('generateStoryboardFromBlueprint', () => {
    it('calculates millisecond timings accurately for all scenes', () => {
      const plan = generateStoryboardFromBlueprint(saasBlueprint);

      expect(plan.blueprintId).toBe(saasBlueprint.id);
      expect(plan.aspectRatio).toBe('9:16');
      expect(plan.totalDurationMs).toBe(saasBlueprint.defaultDurationSec * 1000);
      expect(plan.scenes).toHaveLength(saasBlueprint.scenes.length);

      let prevEndMs = 0;
      for (const scene of plan.scenes) {
        expect(scene.startMs).toBe(prevEndMs);
        expect(scene.endMs).toBeGreaterThan(scene.startMs);
        expect(scene.durationMs).toBe(scene.endMs - scene.startMs);
        expect(scene.visualPrompt.length).toBeGreaterThan(10);
        expect(scene.cameraMotion).toBeDefined();
        prevEndMs = scene.endMs;
      }
      expect(prevEndMs).toBe(plan.totalDurationMs);
    });

    it('incorporates custom narration scene scripts when provided', () => {
      const customNarrations = [
        'Stop spending 10 hours doing this manually.',
        'Here is the exact manual bottleneck you face.',
        'Watch this 3-click AI automation tool.',
        'Before: 8 hours. Now: 45 seconds.',
        'Use code AGENCY30 in bio for free credits.',
      ];

      const plan = generateStoryboardFromBlueprint(saasBlueprint, customNarrations);
      expect(plan.scenes[0]?.narrationText).toBe(customNarrations[0]);
      expect(plan.scenes[4]?.narrationText).toBe(customNarrations[4]);
    });
  });
});
