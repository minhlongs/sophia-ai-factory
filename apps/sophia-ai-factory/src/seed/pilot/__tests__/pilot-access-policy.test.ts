// @vitest-environment node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
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
  enforcePilotPageScopeRedirect,
  enforcePilotServerActionDisabled,
  isGuardedPilotAuthPath,
} from '../pilot-auth-guard';
import { shouldBypassStaticAsset } from '@/middleware/helpers';
import { buildScriptUserPrompt } from '@/seed/ai/script-prompt-builders';
import { validateParsedScriptStructure } from '@/seed/ai/script-generator-helpers';
import { renderFirstValueMarkdown } from '@/tree/first-value/first-value-contract';
import {
  assertAccessPoliciesSafeAndExact,
  buildAccessSingleEmailPolicyPayload,
  buildCustomerUrlsAndVietnameseInvite,
  buildShortlinkSubpathBypassAppPayload,
  buildShortlinkSubpathBypassPolicyPayload,
  DEFAULT_PILOT_OPERATOR_EMAILS,
  resolveAuthorizedPilotEmails,
  validateSinglePilotEmail,
} from '../../../../scripts/pilot-invite-customer.mjs';
import {
  buildPurgeUserStatements,
  sqlEscapeLiteral,
  validateSupportRequestId,
} from '../../../../scripts/pilot-support-queue.mjs';

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

    expect(resolvePilotRefererOrigin({})).toBe('https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev');
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
    expect(shouldBypassStaticAsset('//api/item.json', 'GET', false)).toBe(false);
    expect(shouldBypassStaticAsset('/dashboard/item.json', 'GET', false)).toBe(false);
    expect(shouldBypassStaticAsset('/vi/dashboard/item.json', 'GET', false)).toBe(false);
    expect(shouldBypassStaticAsset('/en/dashboard/item.json', 'GET', false)).toBe(false);
    expect(shouldBypassStaticAsset('/%E0%A4%A.png', 'GET', false)).toBe(false);
    expect(shouldBypassStaticAsset('/vi/first-value', 'GET', false)).toBe(false);
  });

  it('confines pilot UI navigation to First-Value and legal/auth routes via enforcePilotPageScopeRedirect', () => {
    const pilotEnv = { PILOT_INVITE_ONLY: 'true' };
    expect(
      enforcePilotPageScopeRedirect(
        new NextRequest('https://pilot.example.test/vi/dashboard/campaigns'),
        {},
      ),
    ).toBeNull();
    expect(
      enforcePilotPageScopeRedirect(
        new NextRequest('https://pilot.example.test/vi/dashboard/campaigns', { method: 'OPTIONS' }),
        pilotEnv,
      ),
    ).toBeNull();
    expect(
      enforcePilotPageScopeRedirect(
        new NextRequest('https://pilot.example.test/api/first-value'),
        pilotEnv,
      ),
    ).toBeNull();
    expect(
      enforcePilotPageScopeRedirect(
        new NextRequest('https://pilot.example.test/%E0%A4%A'),
        pilotEnv,
      )?.status,
    ).toBe(307);

    for (const allowedPage of [
      'https://pilot.example.test/vi/login',
      'https://pilot.example.test/en/register',
      'https://pilot.example.test/vi/signup',
      'https://pilot.example.test/en/reset-password',
      'https://pilot.example.test/vi/privacy',
      'https://pilot.example.test/en/terms',
      'https://pilot.example.test/vi/dashboard/first-value',
      'https://pilot.example.test/en/dashboard/first-value/',
    ]) {
      expect(enforcePilotPageScopeRedirect(new NextRequest(allowedPage), pilotEnv)).toBeNull();
    }

    const viRedirect = enforcePilotPageScopeRedirect(
      new NextRequest('https://pilot.example.test/vi/dashboard/campaigns'),
      pilotEnv,
    );
    expect(viRedirect?.status).toBe(307);
    expect(viRedirect?.headers.get('location')).toBe(
      'https://pilot.example.test/vi/dashboard/first-value',
    );

    const enHeadRedirect = enforcePilotPageScopeRedirect(
      new NextRequest('https://pilot.example.test/en/pricing', { method: 'HEAD' }),
      pilotEnv,
    );
    expect(enHeadRedirect?.status).toBe(307);
    expect(enHeadRedirect?.headers.get('location')).toBe(
      'https://pilot.example.test/en/dashboard/first-value',
    );
  });
});

describe('scene title schema, prompt builder, and markdown export', () => {
  it('requests scene titles in prompt and validates/exports optional scene titles', () => {
    const prompt = buildScriptUserPrompt('Dental clinic', 'Local families', undefined, undefined, 30);
    expect(prompt).toContain('"title": "Short scene name"');

    const parsed = validateParsedScriptStructure(
      {
        title: 'Clinic Script',
        total_duration: 30,
        scenes: [
          {
            scene_number: 1,
            title: '  Hook: Empty Waiting Room  ',
            visual_description: 'Front desk',
            narration: 'Missed calls cost revenue.',
            duration_estimate: 10,
          },
          {
            scene_number: 2,
            title: '   ',
            visual_description: 'SMS workflow',
            narration: 'Automated reminder confirms visits.',
            duration_estimate: 10,
          },
          {
            scene_number: 3,
            visual_description: 'Booked calendar',
            narration: 'Start with ten patients today.',
            duration_estimate: 10,
          },
        ],
      },
      { minScenes: 3 },
    );

    expect(parsed.scenes[0]?.title).toBe('Hook: Empty Waiting Room');
    expect(parsed.scenes[1]?.title).toBeUndefined();
    expect(parsed.scenes[2]?.title).toBeUndefined();

    expect(() =>
      validateParsedScriptStructure(
        {
          title: 'Invalid Scene Title Type',
          total_duration: 10,
          scenes: [
            {
              scene_number: 1,
              title: 123,
              visual_description: 'Visual',
              narration: 'Narration',
              duration_estimate: 10,
            },
          ],
        },
        { minScenes: 1 },
      ),
    ).toThrow(/title must be a string/);

    expect(() =>
      validateParsedScriptStructure(
        {
          title: 'Too Long Scene Title',
          total_duration: 10,
          scenes: [
            {
              scene_number: 1,
              title: 'x'.repeat(201),
              visual_description: 'Visual',
              narration: 'Narration',
              duration_estimate: 10,
            },
          ],
        },
        { minScenes: 1 },
      ),
    ).toThrow(/must not exceed 200 characters/);

    const md = renderFirstValueMarkdown({
      artifactId: 'art_1',
      sessionId: 'sess_1',
      userId: 'usr_1',
      orgId: 'org_1',
      version: 1,
      idempotencyKey: 'idem_1',
      topic: 'Dental clinic',
      audience: 'Local families',
      durationSec: 30,
      provenance: 'live_provider',
      provenanceLabel: 'LIVE_PROVIDER_AI_INFERENCE',
      script: parsed,
      reviewState: 'accepted',
      acceptedAtIso: '2026-11-24T00:00:00.000Z',
      acceptedByUserId: 'usr_1',
      rejectedAtIso: null,
      rejectionReason: null,
      publicPublished: false,
      mcuCharged: 0,
      optionalNotificationDelivered: false,
      createdAtIso: '2026-11-24T00:00:00.000Z',
    });
    expect(md).toContain('### Scene 1: Hook: Empty Waiting Room (10s)');
    expect(md).toContain('### Scene 2 (10s)');
  });
});

describe('pilot operator CLIs (invite & support queue)', () => {
  it('validates single invited email, rejects wildcards/Bypass, and formats Vietnamese invitation', () => {
    expect(validateSinglePilotEmail('  Founder.Customer@Company.vn ')).toBe(
      'founder.customer@company.vn',
    );
    expect(() => validateSinglePilotEmail('a@b.com,c@d.com')).toThrow(
      /Only a single exact email is allowed/,
    );
    expect(() => validateSinglePilotEmail('*@company.vn')).toThrow(/Wildcard/);
    expect(() => validateSinglePilotEmail('everyone')).toThrow(/Everyone/);
    expect(() => validateSinglePilotEmail('not-an-email')).toThrow(/Invalid email/);

    const authorized = resolveAuthorizedPilotEmails('khach@congty.vn');
    expect(authorized).toEqual([...DEFAULT_PILOT_OPERATOR_EMAILS, 'khach@congty.vn']);
    expect(resolveAuthorizedPilotEmails('billwill.mentor@gmail.com')).toEqual([
      ...DEFAULT_PILOT_OPERATOR_EMAILS,
    ]);

    const bypassApp = buildShortlinkSubpathBypassAppPayload();
    expect(bypassApp.domain).toBe(
      'sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/*',
    );
    expect(buildShortlinkSubpathBypassPolicyPayload().decision).toBe('bypass');

    const policy = {
      id: '5ad49a50-b19a-4cc9-a43d-d2455e92fa42',
      ...buildAccessSingleEmailPolicyPayload('khach@congty.vn'),
    };
    expect(() => assertAccessPoliciesSafeAndExact([policy], 'khach@congty.vn')).not.toThrow();
    expect(() => assertAccessPoliciesSafeAndExact([policy], authorized)).not.toThrow();
    expect(() =>
      assertAccessPoliciesSafeAndExact(
        [{ id: 'other', decision: 'bypass', include: [{ everyone: {} }] }],
        'khach@congty.vn',
      ),
    ).toThrow();
    expect(() =>
      assertAccessPoliciesSafeAndExact(
        [{ ...policy, include: [{ email_domain: { domain: 'congty.vn' } }] }],
        'khach@congty.vn',
      ),
    ).toThrow(/Forbidden broad include rule/);

    const handoff = buildCustomerUrlsAndVietnameseInvite('khach@congty.vn');
    expect(handoff.workspaceUrl).toBe(
      'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/vi/dashboard/first-value',
    );
    expect(handoff.registerUrl).toContain('/vi/register?next=/vi/dashboard/first-value');
    expect(handoff.loginUrl).toContain('/vi/login?next=/vi/dashboard/first-value');
    expect(handoff.inviteVi).toContain('khach@congty.vn');
    expect(handoff.inviteVi).toContain('OpenRouter');
  });

  it('validates support receipt IDs and executes tenant-isolated purge SQL against real migrations', async () => {
    const reqId = validateSupportRequestId('psr_12345678-abcd-ef00-1111-222233334444');
    expect(reqId).toBe('psr_12345678-abcd-ef00-1111-222233334444');
    expect(() => validateSupportRequestId('bad_id')).toThrow(/Invalid support request ID/);
    expect(sqlEscapeLiteral("O'Reilly\nLine")).toBe("'O''Reilly Line'");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-purge-test-'));
    try {
      const sqlite = new NodeSqliteD1Database(path.join(tmpDir, 'purge.sqlite'));
      for (const mig of [
        '0515_first_value_reviews.sql',
        '0517_customer_pilot_first_value.sql',
        '0519_pilot_support_requests.sql',
        '0521_pilot_commercial_validation.sql',
      ]) {
        const sqlText = fs.readFileSync(
          path.resolve(__dirname, '../../../../migrations', mig),
          'utf8',
        );
        await sqlite.exec(sqlText);
      }

      await sqlite.exec(`
        INSERT INTO "user" (id, email, name) VALUES ('usr_pilot_1', 'pilot@example.test', 'Pilot');
        INSERT INTO "session" (id, userId, expiresAt, token) VALUES ('sess_1', 'usr_pilot_1', '2026-12-01', 'tok_1');
        INSERT INTO "account" (id, userId, accountId, providerId, password) VALUES ('acc_1', 'usr_pilot_1', 'usr_pilot_1', 'credential', 'hash');
        INSERT INTO organizations (id, name, slug) VALUES ('org_pilot_1', 'Pilot Org', 'pilot-org');
        INSERT INTO org_members (id, org_id, user_id, role) VALUES ('om_1', 'org_pilot_1', 'usr_pilot_1', 'owner');
        INSERT INTO pilot_usage_quotas (org_id, user_id, used_generations, updated_at_iso) VALUES ('org_pilot_1', 'usr_pilot_1', 3, '2026-11-24T00:00:00Z');
        INSERT INTO pilot_support_requests (id, org_id, user_id, request_type, subject, message, status, created_at_iso, updated_at_iso)
          VALUES ('${reqId}', 'org_pilot_1', 'usr_pilot_1', 'data_deletion', 'Delete me', 'Sensitive note', 'open', '2026-11-24T00:00:00Z', '2026-11-24T00:00:00Z');
      `);

      const sql = buildPurgeUserStatements(
        'usr_pilot_1',
        'org_pilot_1',
        reqId,
        '2026-11-24T01:00:00.000Z',
      );
      await sqlite.exec(sql);

      const remainingUser = await sqlite
        .prepare('SELECT id FROM "user" WHERE id = ?')
        .bind('usr_pilot_1')
        .first();
      expect(remainingUser).toBeNull();

      const remainingQuota = await sqlite
        .prepare('SELECT org_id FROM pilot_usage_quotas WHERE org_id = ?')
        .bind('org_pilot_1')
        .first();
      expect(remainingQuota).toBeNull();

      const completedReq = await sqlite
        .prepare('SELECT status, subject, message FROM pilot_support_requests WHERE id = ?')
        .bind(reqId)
        .first<{ status: string; subject: string; message: string }>();
      expect(completedReq).toEqual({
        status: 'completed',
        subject: '[purged]',
        message: '[purged]',
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
