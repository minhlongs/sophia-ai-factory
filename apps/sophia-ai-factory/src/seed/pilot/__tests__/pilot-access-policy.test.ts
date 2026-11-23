// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  isEmailAllowedForPilot,
  isPilotInviteOnlyEnabled,
  isPilotLiveInferenceEnabled,
  parsePilotAllowedEmails,
  resolvePilotMaxGenerations,
  resolvePilotRateLimitCooldownMs,
  resolvePilotSponsoredOpenRouterKey,
} from '../pilot-access-policy';
import {
  enforcePilotAuthAllowlist,
  enforcePilotFeatureDisabled,
  isGuardedPilotAuthPath,
} from '../pilot-auth-guard';

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
});
