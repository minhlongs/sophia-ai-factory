// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  isEmailAllowedForPilot,
  isPilotInviteOnlyEnabled,
  isPilotLiveInferenceEnabled,
  parsePilotAllowedEmails,
  resolvePilotCostControls,
  resolvePilotFinancingMode,
  resolvePilotMaxGenerations,
  resolvePilotRateLimitCooldownMs,
  resolvePilotRefererOrigin,
  resolvePilotSponsoredOpenRouterKey,
} from '../pilot-access-policy';
import {
  enforcePilotAuthAllowlist,
  enforcePilotFeatureDisabled,
  enforcePilotServerActionDisabled,
  isGuardedPilotAuthPath,
} from '../pilot-auth-guard';
import { shouldBypassStaticAsset } from '@/middleware/helpers';

describe('pilot-access-policy', () => {
  it('defaults to fail-closed disabled flags', () => {
    expect(isPilotInviteOnlyEnabled({})).toBe(false);
    expect(isPilotLiveInferenceEnabled({})).toBe(false);
    expect(resolvePilotMaxGenerations({})).toBe(20);
    expect(resolvePilotRateLimitCooldownMs({})).toBe(5000);
    expect(resolvePilotSponsoredOpenRouterKey({})).toBeNull();
  });

  it('parses allowlist emails case-insensitively and fails closed when empty in invite-only mode', () => {
    const emptyInviteEnv = { PILOT_INVITE_ONLY: 'true', PILOT_ALLOWED_EMAILS: '' };
    expect(Array.from(parsePilotAllowedEmails(emptyInviteEnv))).toEqual([]);
    expect(isEmailAllowedForPilot('pilot@example.test', emptyInviteEnv)).toBe(false);

    const allowedEnv = {
      PILOT_INVITE_ONLY: 'true',
      PILOT_ALLOWED_EMAILS: ' Pilot.Customer@Example.Test , second@example.test ',
    };
    expect(isEmailAllowedForPilot('pilot.customer@example.test', allowedEnv)).toBe(true);
    expect(isEmailAllowedForPilot('intruder@example.test', allowedEnv)).toBe(false);
    expect(isEmailAllowedForPilot(null, allowedEnv)).toBe(false);
  });

  it('clamps generation quota and cooldown bounds safely', () => {
    expect(resolvePilotMaxGenerations({ PILOT_MAX_GENERATIONS: '500' })).toBe(100);
    expect(resolvePilotMaxGenerations({ PILOT_MAX_GENERATIONS: '0' })).toBe(1);
    expect(resolvePilotMaxGenerations({ PILOT_MAX_GENERATIONS: '15' })).toBe(15);
    expect(resolvePilotRateLimitCooldownMs({ PILOT_RATE_LIMIT_COOLDOWN_MS: '0' })).toBe(0);
    expect(resolvePilotRateLimitCooldownMs({ PILOT_RATE_LIMIT_COOLDOWN_MS: '999999' })).toBe(300000);
  });

  it('resolves single active financing mode and fails closed on unknown values', () => {
    expect(resolvePilotFinancingMode({ PILOT_INVITE_ONLY: 'true' })).toBe('FOUNDER_SPONSORED');
    expect(resolvePilotFinancingMode({})).toBe('CUSTOMER_BYOK');
    expect(resolvePilotFinancingMode({ PILOT_FINANCING_MODE: 'FOUNDER_SPONSORED' })).toBe(
      'FOUNDER_SPONSORED',
    );
    expect(resolvePilotFinancingMode({ PILOT_FINANCING_MODE: 'customer_byok' })).toBe(
      'CUSTOMER_BYOK',
    );
    expect(resolvePilotFinancingMode({ PILOT_FINANCING_MODE: 'DISABLED' })).toBe('DISABLED');
    expect(resolvePilotFinancingMode({ PILOT_FINANCING_MODE: 'HYBRID_FALLBACK' })).toBe('DISABLED');
  });

  it('validates pilot cost controls fail-closed and resolves pilot referer origin', () => {
    const missing = resolvePilotCostControls({});
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.missingOrInvalid).toContain('PILOT_MAX_GENERATIONS');
      expect(missing.missingOrInvalid).toContain('PILOT_MAX_ESTIMATED_SPEND_USD');
    }

    const unsafeOverrides = resolvePilotCostControls({
      PILOT_MAX_GENERATIONS: '20',
      PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
      PILOT_MODEL_ID: 'anthropic/claude-opus-4',
      PILOT_MAX_OUTPUT_TOKENS: '8192',
      PILOT_MAX_RETRIES: '5',
      PILOT_TIMEOUT_MS: '120000',
      PILOT_ESTIMATED_COST_PER_ATTEMPT_USD: '10',
    });
    expect(unsafeOverrides.ok).toBe(false);
    if (!unsafeOverrides.ok) {
      expect(unsafeOverrides.missingOrInvalid).toEqual(
        expect.arrayContaining([
          'PILOT_MODEL_ID',
          'PILOT_MAX_OUTPUT_TOKENS',
          'PILOT_MAX_RETRIES',
          'PILOT_TIMEOUT_MS',
          'PILOT_ESTIMATED_COST_PER_ATTEMPT_USD',
        ]),
      );
    }

    const valid = resolvePilotCostControls({
      PILOT_MAX_GENERATIONS: '20',
      PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
      PILOT_MODEL_ID: 'openai/gpt-4o-mini',
      PILOT_MAX_OUTPUT_TOKENS: '2048',
      PILOT_MAX_RETRIES: '1',
      PILOT_TIMEOUT_MS: '45000',
      PILOT_ESTIMATED_COST_PER_ATTEMPT_USD: '0.02',
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.config.maxEstimatedSpendMicroUsd).toBe(4_000_000);
      expect(valid.config.estimatedCostPerAttemptMicroUsd).toBe(20_000);
      expect(valid.config.modelId).toBe('openai/gpt-4o-mini');
      expect(valid.config.inFlightLockMs).toBe(110_000);
    }

    expect(resolvePilotRefererOrigin({})).toBe('https://pilot.sophia.agencyos.network');
    expect(resolvePilotRefererOrigin({ APP_URL: 'https://beta.example.test/' })).toBe(
      'https://beta.example.test',
    );
  });
});

describe('pilot-auth-guard', () => {
  it('identifies guarded auth paths including OTP/passkey and leaves sign-out unguarded', () => {
    expect(isGuardedPilotAuthPath('/api/auth/sign-up')).toBe(true);
    expect(isGuardedPilotAuthPath('/api/auth/sign-up/email')).toBe(true);
    expect(isGuardedPilotAuthPath('/api/auth/sign-in/email')).toBe(true);
    expect(isGuardedPilotAuthPath('/api/auth/sign-in/magic-link')).toBe(true);
    expect(isGuardedPilotAuthPath('/api/auth/sign-in/email-otp')).toBe(true);
    expect(isGuardedPilotAuthPath('/api/auth/email-otp/send-verification-otp')).toBe(true);
    expect(isGuardedPilotAuthPath('/api/auth/passkey/generate-register-options')).toBe(true);
    expect(isGuardedPilotAuthPath('/api/auth/sign-out')).toBe(false);
    expect(isGuardedPilotAuthPath('/api/auth/get-session')).toBe(false);
  });

  it('enforces PAYMENTS_ENABLED=false and B2_PUBLISH_ENABLED=false runtime kill-switches', async () => {
    const pilotEnv = { PAYMENTS_ENABLED: 'false', B2_PUBLISH_ENABLED: 'false' };

    for (const path of [
      '/api/checkout',
      '/api/checkout/status',
      '//api//checkout/',
      '/%61pi/checkout',
      '/%E0%A4%A/checkout',
      '/api/orders',
      '/api/promo/redeem-free',
      '/api/v1/credits/purchase',
      '/api/payments/checkout',
      '/api/webhooks/payos',
      '/api/webhooks/nowpayments',
      '/api/webhooks/nowpayments-payout',
      '/api/webhooks/saas-crypto',
    ]) {
      const res = enforcePilotFeatureDisabled(path, pilotEnv);
      expect(res?.status).toBe(403);
      expect(((await res?.json()) as { code: string }).code).toBe('PILOT_PAYMENTS_DISABLED');
    }

    for (const path of [
      '/api/b2/publish',
      '/api/publish',
      '/api/publish-approvals',
      '/api/publish-gate',
      '/api/distribution',
      '/api/schedule',
      '/api/v1/distribute/jobs',
      '/api/v1/videos/vid_123/distribute',
      '/api/v1/videos/vid.123/distribute',
      '/api/oauth/youtube/connect',
      '/api/oauth/tiktok/connect',
      '/api/oauth/instagram/connect',
      '/api/oauth/facebook/callback',
    ]) {
      const res = enforcePilotFeatureDisabled(path, pilotEnv);
      expect(res?.status).toBe(403);
      expect(((await res?.json()) as { code: string }).code).toBe('PILOT_PUBLISHING_DISABLED');
    }

    // Non-pilot envs (flags unset) pass through
    expect(enforcePilotFeatureDisabled('/api/checkout', {})).toBeNull();
    expect(enforcePilotFeatureDisabled('/api/first-value', pilotEnv)).toBeNull();
  });

  it('blocks uninvited email sign-up and allows invited email when PILOT_INVITE_ONLY=true', async () => {
    const env = {
      PILOT_INVITE_ONLY: 'true',
      PILOT_ALLOWED_EMAILS: 'invited@example.test',
    };

    const blockedRes = enforcePilotAuthAllowlist(
      '/api/auth/sign-up/email',
      JSON.stringify({ email: 'stranger@example.test', password: 'Password123!' }),
      env,
    );
    expect(blockedRes).not.toBeNull();
    expect(blockedRes?.status).toBe(403);
    expect(blockedRes?.headers.get('cache-control')).toBe('private, no-store');
    const blockedBody = (await blockedRes?.json()) as { code: string };
    expect(blockedBody.code).toBe('PILOT_INVITE_REQUIRED');

    const allowedRes = enforcePilotAuthAllowlist(
      '/api/auth/sign-up/email',
      JSON.stringify({ email: 'INVITED@example.test', password: 'Password123!' }),
      env,
    );
    expect(allowedRes).toBeNull();
  });

  it('passes through when PILOT_INVITE_ONLY is not enabled', () => {
    const res = enforcePilotAuthAllowlist(
      '/api/auth/sign-up/email',
      JSON.stringify({ email: 'anyone@example.test', password: 'Password123!' }),
      {},
    );
    expect(res).toBeNull();
  });

  it('locks down non-pilot API routes when PILOT_INVITE_ONLY=true while keeping pilot routes open', async () => {
    const strictEnv = {
      PILOT_INVITE_ONLY: 'true',
      PAYMENTS_ENABLED: 'false',
      B2_PUBLISH_ENABLED: 'false',
    };

    for (const blockedPath of [
      '/api/v1/generate',
      '/api/v1/scripts',
      '/api/v1/videos',
      '/api/campaigns',
      '/api/inngest',
      '/api/tts',
      '/api/user/api-keys',
      '/api/admin/users',
      '/api/health/%2e%2e/payments/checkout',
      '/api/auth/../v1/credits',
      '/api/health/%5c..%5ccheckout',
    ]) {
      const res = enforcePilotFeatureDisabled(blockedPath, strictEnv);
      expect(res?.status).toBe(403);
    }

    for (const allowedPath of [
      '/api/first-value',
      '/api/auth/sign-in/email',
      '/api/health',
      '/api/version',
      '/api/check-access',
      '/api/csp-report',
      '/vi/dashboard/first-value',
    ]) {
      expect(enforcePilotFeatureDisabled(allowedPath, strictEnv)).toBeNull();
    }

    // Blocks all Next.js Server Actions and non-GET page mutations (pilot uses /api/* only)
    expect(
      enforcePilotServerActionDisabled('/vi/dashboard/campaigns', true, strictEnv, 'POST')?.status,
    ).toBe(403);
    expect(
      enforcePilotServerActionDisabled('/vi/dashboard/campaigns', false, strictEnv, 'POST')?.status,
    ).toBe(403);
    expect(
      enforcePilotServerActionDisabled('/vi/settings', true, strictEnv, 'POST')?.status,
    ).toBe(403);
    expect(
      enforcePilotServerActionDisabled('/vi/first-value', true, strictEnv, 'POST')?.status,
    ).toBe(403);
    expect(
      enforcePilotServerActionDisabled('/en/dashboard/first-value', true, strictEnv, 'POST')
        ?.status,
    ).toBe(403);
    expect(
      enforcePilotServerActionDisabled('/en/dashboard/first-value', false, strictEnv, 'GET'),
    ).toBeNull();
    expect(
      enforcePilotServerActionDisabled('/vi/dashboard/campaigns', false, strictEnv, 'GET'),
    ).toBeNull();
    expect(
      enforcePilotServerActionDisabled('/api/first-value', false, strictEnv, 'POST'),
    ).toBeNull();

    // Static asset bypass never short-circuits mutating, next-action, /api, or /dashboard paths
    expect(shouldBypassStaticAsset('/logo.png', 'GET', false)).toBe(true);
    expect(shouldBypassStaticAsset('/logo.png', 'HEAD', false)).toBe(true);
    expect(shouldBypassStaticAsset('/logo.png', 'POST', false)).toBe(false);
    expect(shouldBypassStaticAsset('/logo.png', 'GET', true)).toBe(false);
    expect(shouldBypassStaticAsset('/api/v1/videos/vid.123/distribute', 'GET', false)).toBe(false);
    expect(shouldBypassStaticAsset('/dashboard/item.json', 'GET', false)).toBe(false);
    expect(shouldBypassStaticAsset('/vi/first-value', 'GET', false)).toBe(false);
  });
});
