import { CANONICAL_TRUSTED_ORIGINS } from './types';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { createServerClient } from '@/seed/db/client';
import { grantSignupBonusCredits } from '@/seed/auth/signup-bonus';
import { bootstrapFounderIfConfigured } from '@/seed/auth/founder-bootstrap';
import { sendSeedEmail } from '@/seed/email/email-sender';
import { buildWelcomeHtml } from './plugin-configs';

export function resolveBaseURL(): string {
  const globalEnv = (globalThis as unknown as { __env__?: Record<string, unknown> })?.__env__;
  const cfBetterAuthUrl = typeof globalEnv?.BETTER_AUTH_URL === 'string' ? globalEnv.BETTER_AUTH_URL : undefined;
  const cfAppUrl = typeof globalEnv?.APP_URL === 'string' ? globalEnv.APP_URL : undefined;

  const isProduction = process.env.NODE_ENV === 'production';
  const envAuthUrl = process.env.BETTER_AUTH_URL || cfBetterAuthUrl || process.env.APP_URL || cfAppUrl;
  const isLocalEnvUrl = Boolean(envAuthUrl && (envAuthUrl.includes('localhost') || envAuthUrl.includes('127.0.0.1')));

  if (isProduction) {
    if (envAuthUrl && !isLocalEnvUrl) {
      return envAuthUrl.replace(/\/+$/, '');
    }
    return 'https://sophia.agencyos.network';
  }

  return (envAuthUrl || 'http://localhost:3000').replace(/\/+$/, '');
}

export function resolveTrustedOrigins(customBaseURL?: string): string[] {
  const base = customBaseURL || resolveBaseURL();
  const globalEnv = (globalThis as unknown as { __env__?: Record<string, unknown> })?.__env__;
  const cfBetterAuthUrl = typeof globalEnv?.BETTER_AUTH_URL === 'string' ? globalEnv.BETTER_AUTH_URL : undefined;
  const cfAppUrl = typeof globalEnv?.APP_URL === 'string' ? globalEnv.APP_URL : undefined;
  const cfNextPublicAppUrl = typeof globalEnv?.NEXT_PUBLIC_APP_URL === 'string' ? globalEnv.NEXT_PUBLIC_APP_URL : undefined;
  const cfTrustedOrigins = typeof globalEnv?.TRUSTED_ORIGINS === 'string' ? globalEnv.TRUSTED_ORIGINS : undefined;

  const dynamicOriginCandidates = [
    base,
    process.env.BETTER_AUTH_URL,
    cfBetterAuthUrl,
    process.env.APP_URL,
    cfAppUrl,
    process.env.NEXT_PUBLIC_APP_URL,
    cfNextPublicAppUrl,
    ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(',') : []),
    ...(cfTrustedOrigins ? cfTrustedOrigins.split(',') : []),
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',') : []),
  ];

  const originsSet = new Set<string>();
  for (const canonical of CANONICAL_TRUSTED_ORIGINS) {
    originsSet.add(canonical);
  }
  for (const candidate of dynamicOriginCandidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim().replace(/\/+$/, '');
      if (trimmed) originsSet.add(trimmed);
    }
  }

  return Array.from(originsSet);
}

export function sanitizeAndResolveUserName(rawName?: unknown, email?: unknown): string {
  const nameStr = typeof rawName === 'string' ? rawName : '';
  let sanitized = nameStr.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);

  if (!sanitized) {
    const emailStr = typeof email === 'string' ? email : '';
    const emailPrefix = emailStr.includes('@') ? emailStr.split('@')[0].trim() : emailStr.trim();
    sanitized = (emailPrefix || 'user').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) || 'user';
  }

  return sanitized;
}

export async function handleUserCreateBefore<T extends { name?: unknown; email?: unknown }>(
  user: T,
): Promise<{ data: Omit<T, 'name'> & { name: string } }> {
  const name = sanitizeAndResolveUserName(user.name, user.email);
  return { data: { ...user, name } };
}

export async function provisionNewUser(user: { id: string; name?: string | null; email?: string | null }): Promise<void> {
  try {
    const db = createServerClient();
    if (!db) throw new Error('D1 database binding not available');
    const orgId = crypto.randomUUID();
    const emailStr = typeof user.email === 'string' ? user.email : '';
    const rawPrefix = emailStr.includes('@') ? emailStr.split('@')[0] : (emailStr || 'user');
    const prefix = rawPrefix.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'user';
    const slug = `${prefix}-${orgId.slice(0, 6)}`;
    const orgName = (typeof user.name === 'string' && user.name.trim()) || user.email || 'Personal';

    const maxRetries = 2;
    let insertError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await db.from('organizations').insert({ id: orgId, name: orgName, slug });
        await db.from('org_members').insert({ org_id: orgId, user_id: user.id, role: 'owner' });
        await db.from('org_balances').insert({ org_id: orgId, balance: 50 });
        await db.from('subscriptions').insert({
          id: crypto.randomUUID(), user_id: user.id, org_id: orgId, plan: 'basic', tier: 'BASIC', status: 'active',
        });
        await db.from('user_profiles').insert({
          user_id: user.id, display_name: user.name || null, subscription_tier: 'BASIC',
        });
        insertError = null;
        break;
      } catch (e) {
        insertError = toError(e);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        }
      }
    }

    if (insertError) {
      const fallbackOrgId = crypto.randomUUID();
      const fallbackSlug = `${prefix}-${fallbackOrgId.slice(0, 6)}`;
      try {
        await db.from('organizations').insert({ id: fallbackOrgId, name: orgName, slug: fallbackSlug });
        await db.from('org_members').insert({ org_id: fallbackOrgId, user_id: user.id, role: 'owner' });
        await db.from('org_balances').insert({ org_id: fallbackOrgId, balance: 50 });
        await db.from('subscriptions').insert({
          id: crypto.randomUUID(), user_id: user.id, org_id: fallbackOrgId, plan: 'basic', tier: 'BASIC', status: 'active',
        });
        await db.from('user_profiles').insert({
          user_id: user.id, display_name: user.name || null, subscription_tier: 'BASIC',
        });
      } catch (fallbackErr) {
        logger.error('[databaseHook] org creation fallback failed', toError(fallbackErr));
      }
    }

    await grantSignupBonusCredits(user.id, 50);

    const isEmailVerified = Boolean((user as unknown as { emailVerified?: boolean | number }).emailVerified);
    if (isEmailVerified) {
      await bootstrapFounderIfConfigured(user as Parameters<typeof bootstrapFounderIfConfigured>[0]);
    } else {
      logger.info('[databaseHook] Founder bootstrap deferred: email not verified', undefined, {
        userId: user.id, email: user.email,
      });
    }
  } catch (err) {
    logger.error('[databaseHook] org creation failed', toError(err));
  }

  if (user.email) {
    sendSeedEmail({
      to: user.email,
      subject: 'Welcome to Sophia AI Factory!',
      html: buildWelcomeHtml(user.name || user.email),
    }).catch(() => {});
  }
}
