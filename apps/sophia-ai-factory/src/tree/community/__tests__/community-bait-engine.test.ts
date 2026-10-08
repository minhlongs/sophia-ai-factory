/**
 * @file community-bait-engine.test.ts
 * @description Unit tests for Community Comment Viral Bait & Discussion Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import { generateCommunityBaitCampaign } from '../community-bait-engine';
import type { CommunityBaitInput } from '@/seed/types/growth-triad-v8-types';

describe('Community Bait Engine (Pillar 2)', () => {
  it('generates high curiosity gap hook for entrepreneur audience', () => {
    const input: CommunityBaitInput = {
      videoId: 'vid-saas-101',
      videoTopic: 'AI Automation Agency',
      sentimentPolarityScore: 0.52, // Balanced debate
      targetAudienceType: 'ENTREPRENEUR',
    };

    const campaign = generateCommunityBaitCampaign(input);

    expect(campaign.videoId).toBe('vid-saas-101');
    expect(campaign.primaryHook.hookQuestion).toContain('AI Automation Agency');
    expect(campaign.primaryHook.curiosityGapScore).toBeGreaterThan(0.7);
    expect(campaign.primaryHook.brandSafetyPassed).toBe(true);
    expect(campaign.alternativeHooks).toHaveLength(2);
  });

  it('tailors questions for developer audience', () => {
    const input: CommunityBaitInput = {
      videoId: 'vid-dev-202',
      videoTopic: 'Serverless Edge Architecture',
      sentimentPolarityScore: 0.45,
      targetAudienceType: 'DEVELOPER',
    };

    const campaign = generateCommunityBaitCampaign(input);

    expect(campaign.primaryHook.hookQuestion).toContain('100k RPS');
    expect(campaign.alternativeHooks[0].hookQuestion).toContain('Stack công nghệ');
    expect(campaign.primaryHook.estimatedCommentVelocity).toBeGreaterThan(50);
  });
});
