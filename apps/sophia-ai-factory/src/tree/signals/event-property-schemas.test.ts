import { describe, expect, it } from 'vitest';
import {
  ByokConfiguredSchema, CampaignCreatedSchema, CampaignPublishedSchema, ChurnSignalSchema,
  CtaClickSchema, ExperimentAssignedSchema, FirstVideoCompletedSchema, FirstVideoStartedSchema,
  FreeQuotaExhaustionSchema, PageviewSchema, PaymentSucceededSchema, ReferralSignupSchema,
  SignupSchema, SopInstalledSchema, TierUpgradedSchema, VideoRenderedSchema,
  WizardCompletedSchema, WizardStepSchema,
} from './event-property-schemas';

describe('PostHog event property allowlists', () => {
  it('accepts each documented event payload and rejects invalid constrained fields', () => {
    expect(SignupSchema.parse({ plan: 'basic', locale: 'vi', referrer: 'invite', niche: 'saas' })).toBeTruthy();
    expect(PageviewSchema.parse({ path: '/pricing' })).toBeTruthy();
    expect(CtaClickSchema.parse({ element: 'start', page: '/home' })).toBeTruthy();
    expect(WizardStepSchema.parse({ step: 1, step_name: 'connect' })).toBeTruthy();
    expect(WizardCompletedSchema.parse({ duration_ms: 100 })).toBeTruthy();
    expect(ByokConfiguredSchema.parse({ service: 'openrouter' })).toBeTruthy();
    expect(CampaignCreatedSchema.parse({ campaign_type: 'shorts' })).toBeTruthy();
    expect(CampaignPublishedSchema.parse({ campaign_type: 'shorts', channels: 'youtube' })).toBeTruthy();
    expect(FirstVideoStartedSchema.parse({ campaign_id: 'c1', tier: 'basic' })).toBeTruthy();
    expect(FirstVideoCompletedSchema.parse({ campaign_id: 'c1', duration_s: 10, tier: 'basic' })).toBeTruthy();
    expect(ExperimentAssignedSchema.parse({ experiment: 'pricing', variant: 'b' })).toBeTruthy();
    expect(FreeQuotaExhaustionSchema.parse({ tier: 'free', used: 10, limit: 10 })).toBeTruthy();
    expect(VideoRenderedSchema.parse({ duration_s: 10, resolution: '1080p' })).toBeTruthy();
    expect(TierUpgradedSchema.parse({ tier: 'pro', amount: 30, currency: 'USD' })).toBeTruthy();
    expect(PaymentSucceededSchema.parse({ amount: 30, currency: 'USD' })).toBeTruthy();
    expect(ChurnSignalSchema.parse({ reason: 'cost', tier: 'pro' })).toBeTruthy();
    expect(SopInstalledSchema.parse({ sop_id: 's1', sop_name: 'Onboarding', sop_author: 'ops' })).toBeTruthy();
    expect(ReferralSignupSchema.parse({ referrer: 'partner-1', referred_user_id: 'u2', source: 'link' })).toBeTruthy();
    expect(ByokConfiguredSchema.safeParse({ service: 'unknown' }).success).toBe(false);
    expect(WizardStepSchema.safeParse({ step: 0, step_name: 'invalid' }).success).toBe(false);
  });
});
