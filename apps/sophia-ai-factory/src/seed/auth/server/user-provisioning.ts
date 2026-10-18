import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { createServerClient } from '@/seed/db/client';
import { grantSignupBonusCredits } from '@/seed/auth/signup-bonus';
import { bootstrapFounderIfConfigured } from '@/seed/auth/founder-bootstrap';
import { sendSeedEmail } from '@/seed/email/email-sender';
import { buildWelcomeHtml } from './plugin-configs';

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

async function insertDefaultOrgRecords(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  orgId: string,
  orgName: string,
  slug: string,
  user: { id: string; name?: string | null },
): Promise<void> {
  await db.from('organizations').insert({ id: orgId, name: orgName, slug });
  await db.from('org_members').insert({ org_id: orgId, user_id: user.id, role: 'owner' });
  await db.from('org_balances').insert({ org_id: orgId, balance: 50 });
  await db.from('subscriptions').insert({
    id: crypto.randomUUID(), user_id: user.id, org_id: orgId, plan: 'basic', tier: 'BASIC', status: 'active',
  });
  await db.from('user_profiles').insert({
    user_id: user.id, display_name: user.name || null, subscription_tier: 'BASIC',
  });
}

async function createOrgWithRetries(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  prefix: string,
  orgName: string,
  user: { id: string; name?: string | null },
): Promise<void> {
  const orgId = crypto.randomUUID();
  const slug = `${prefix}-${orgId.slice(0, 6)}`;
  const maxRetries = 2;
  let insertError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await insertDefaultOrgRecords(db, orgId, orgName, slug, user);
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
      await insertDefaultOrgRecords(db, fallbackOrgId, orgName, fallbackSlug, user);
    } catch (fallbackErr) {
      logger.error('[databaseHook] org creation fallback failed', toError(fallbackErr));
    }
  }
}

export async function provisionNewUser(user: { id: string; name?: string | null; email?: string | null }): Promise<void> {
  try {
    const db = createServerClient();
    if (!db) throw new Error('D1 database binding not available');
    const emailStr = typeof user.email === 'string' ? user.email : '';
    const rawPrefix = emailStr.includes('@') ? emailStr.split('@')[0] : (emailStr || 'user');
    const prefix = rawPrefix.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'user';
    const orgName = (typeof user.name === 'string' && user.name.trim()) || user.email || 'Personal';

    await createOrgWithRetries(db, prefix, orgName, user);
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
