/**
 * Better Auth server configuration — D1 Kysely adapter.
 *
 * Replaces custom JWT auth with Better Auth framework.
 * Uses lazy initialization to avoid D1 binding issues at build time.
 */

import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';

// NOTE: `sendEmail` (forest) and `hashPassword`/`verifyPassword` (tree) are loaded via lazy
// dynamic import inside the relevant Better Auth callbacks below. Static top-level imports
// were removed to satisfy the seed→(forest|tree) layer boundary rule.
// See plans/260512-2001-mekong-sops-gap-bridge/phase-03-layer-fix.md.
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { requireMfaIfEnabled, markSessionMfaPending } from '@/seed/auth/mfa/login-challenge';
import { escapeHtml } from '@/seed/security/input-sanitization-utilities';
import { getD1, createServerClient } from '@/seed/db/client';
import { bootstrapFounderIfConfigured } from '@/seed/auth/founder-bootstrap';
import { hashPassword, verifyPassword } from '@/seed/security/password-hash';
import { grantSignupBonusCredits } from '@/seed/auth/signup-bonus';
import { revokeAllUserSessions } from '@/seed/auth/revoke-user-sessions';


// Use `any` here to escape Better Auth's deeply-nested generic inference. The
// public surface (`getAuth()` return + `getCurrentUser()` consumers) re-narrows
// at call sites via the better-auth-session helper.
type AuthInstance = ReturnType<typeof betterAuth>;
let _auth: AuthInstance | null = null;

export const CANONICAL_TRUSTED_ORIGINS: readonly string[] = [
  'https://sophia.agencyos.network',
  'https://sophia-ai-factory.agencyos-openclaw.workers.dev',
  'https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev',
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8787',
] as const;

/**
 * Robust baseURL resolution supporting Node.js and Cloudflare Workers edge runtime.
 * Never allows production to fall back to localhost even if misconfigured.
 */
export function resolveBaseURL(): string {
  const globalEnv = (globalThis as unknown as { __env__?: Record<string, unknown> })?.__env__;
  const cfBetterAuthUrl = typeof globalEnv?.BETTER_AUTH_URL === 'string' ? globalEnv.BETTER_AUTH_URL : undefined;
  const cfAppUrl = typeof globalEnv?.APP_URL === 'string' ? globalEnv.APP_URL : undefined;

  const isProduction = process.env.NODE_ENV === 'production';
  const envAuthUrl = process.env.BETTER_AUTH_URL || cfBetterAuthUrl || process.env.APP_URL || cfAppUrl;
  const isLocalEnvUrl = Boolean(envAuthUrl && (envAuthUrl.includes('localhost') || envAuthUrl.includes('127.0.0.1')));

  // In production, ignore accidental localhost env vars and fall back to canonical production URL
  if (isProduction) {
    if (envAuthUrl && !isLocalEnvUrl) {
      return envAuthUrl.replace(/\/+$/, '');
    }
    return 'https://sophia.agencyos.network';
  }

  return (envAuthUrl || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Build trustedOrigins: unconditionally and deterministically include all
 * canonical production, staging, and development domains, plus any dynamic
 * origins from runtime environment variables.
 */
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
      if (trimmed) {
        originsSet.add(trimmed);
      }
    }
  }

  return Array.from(originsSet);
}

/**
 * Defensive user name sanitizer and resolver.
 * Falls back to sanitized email prefix if name is empty or missing (e.g. magic link login).
 */
export function sanitizeAndResolveUserName(rawName?: unknown, email?: unknown): string {
  const nameStr = typeof rawName === 'string' ? rawName : '';
  let sanitized = nameStr
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 100);

  if (!sanitized) {
    const emailStr = typeof email === 'string' ? email : '';
    const emailPrefix = emailStr.includes('@')
      ? emailStr.split('@')[0].trim()
      : emailStr.trim();
    sanitized = (emailPrefix || 'user')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 100) || 'user';
  }

  return sanitized;
}

export async function handleUserCreateBefore<T extends { name?: unknown; email?: unknown }>(
  user: T,
): Promise<{ data: Omit<T, 'name'> & { name: string } }> {
  const name = sanitizeAndResolveUserName(user.name, user.email);
  return { data: { ...user, name } };
}

export function resetAuthForTesting(): void {
  _auth = null;
}

/**
 * Get the Better Auth instance (lazy singleton per isolate).
 * Safe to call in request handlers — D1 is available at that point.
 */
export async function getAuth() {
  if (_auth) return _auth;

  const d1 = await getD1();
  if (!d1) throw new Error('D1 database binding not available');
  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET or JWT_SECRET must be set');

  // Determine baseURL and trusted origins deterministically
  const baseURL = resolveBaseURL();
  const trustedOrigins = resolveTrustedOrigins(baseURL);

  // Better Auth's deep generic inference produces a narrower Auth<...> than
  // the default `Auth<BetterAuthOptions>` carried by `ReturnType<typeof betterAuth>`.
  // Two structurally-equivalent Prettify types appear in the diagnostic, so we
  // cast to the parent type to break the inference loop.
  _auth = betterAuth({
    database: d1,
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      // Risk #10: Immediately invalidate active sessions on password reset
      revokeSessionsOnPasswordReset: true,
      // M10 fix (2026-07-01): Password complexity enforcement.
      // Better Auth will validate at sign-up and password-reset.
      password: {
        hash: (password: string) => hashPassword(password),
        verify: ({ hash, password }: { hash: string; password: string }) => verifyPassword(password, hash),
        validate: (password: string) => {
          const issues: string[] = [];
          if (password.length < 8) issues.push('at least 8 characters');
          if (!/[A-Z]/.test(password)) issues.push('one uppercase letter');
          if (!/[a-z]/.test(password)) issues.push('one lowercase letter');
          if (!/[0-9]/.test(password)) issues.push('one number');
          if (issues.length > 0) {
            return { success: false, message: `Password requires: ${issues.join(', ')}` };
          }
          return { success: true };
        },
      },
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'user' },
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      // Force __Secure- prefix in production so cookie name is deterministic.
      // Without useSecureCookies, Better Auth auto-detects from x-forwarded-proto
      // which may be missing behind Cloudflare Workers, causing prefix mismatch.
      useSecureCookies: process.env.NODE_ENV !== 'development',
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: process.env.NODE_ENV !== 'development',
        httpOnly: true,
        path: '/',
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          // Better-Auth callback doesn't expose locale; ship a bilingual template
          // (EN heading + VI subheading) so users in either locale recognize it.
          // Lazy import keeps seed layer free of static forest dependency.
          const { sendEmail } = await import('@/tree/email/sender');
          await sendEmail({
            to: email,
            subject: 'Sign in to Sophia AI Factory · Đăng nhập Sophia AI',
            html: buildMagicLinkHtml(url),
          });
        },
        expiresIn: 900,
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            try {
              const { required } = await requireMfaIfEnabled(session.userId);
              if (required) {
                await markSessionMfaPending(session.id);
              }
            } catch (err) {
              // Fail-closed: on any MFA check error, abort session creation
              logger.error('[databaseHook] MFA pre-session check failed', toError(err));
              throw new Error('MFA verification setup failed');
            }
          },
        },
      },
      user: {
        create: {
          before: async (user) => {
            const name = sanitizeAndResolveUserName(user.name, user.email);
            return { data: { ...user, name } };
          },
          after: async (user) => {
            try {
              const db = createServerClient();
              if (!db) throw new Error('D1 database binding not available');
              const orgId = crypto.randomUUID();
              const emailStr = typeof user.email === 'string' ? user.email : '';
              const rawPrefix = emailStr.includes('@') ? emailStr.split('@')[0] : (emailStr || 'user');
              const prefix = rawPrefix.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'user';
              const slug = `${prefix}-${orgId.slice(0, 6)}`;
              const orgName = (typeof user.name === 'string' && user.name.trim()) || user.email || 'Personal';

              // Retry transient D1 failures at signup. uuidv7 is unique by construction,
              // so retrying the insert is idempotent-safe and gives us ibise/retry budget.
              const maxRetries = 2;
              let insertError: Error | null = null;
              for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                  await db.from('organizations').insert({
                    id: orgId, name: orgName, slug,
                  });
                  await db.from('org_members').insert({
                    org_id: orgId, user_id: user.id, role: 'owner',
                  });
                  await db.from('org_balances').insert({
                    org_id: orgId, balance: 50,
                  });
                  // Migration 0086 added user_id + tier columns. Insert both so
                  // getUserTier(user_id) works directly without falling back to org lookup.
                  await db.from('subscriptions').insert({
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    org_id: orgId,
                    plan: 'basic',
                    tier: 'BASIC',
                    status: 'active',
                  });
                  // Auto-create user_profiles row (migration 0004). Without it,
                  // any `.single()` read on user_profiles throws for new BASIC
                  // users — broke /dashboard/analytics + admin checkAdmin until
                  // Phase 05 wrapped them defensively. Auto-INSERT at signup is
                  // the root-cause fix so other callers don't need their own
                  // null-handling boilerplate.
                  await db.from('user_profiles').insert({
                    user_id: user.id,
                    display_name: user.name || null,
                    subscription_tier: 'BASIC',
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
                // Final fallback — signup should not be blocked by a transient D1 blip.
                // Generate a fresh slug suffix so the minimal row still satisfies unique
                // constraints without depending on the original slug attempt.
                const fallbackOrgId = crypto.randomUUID();
                const fallbackSlug = `${prefix}-${fallbackOrgId.slice(0, 6)}`;
                try {
                  await db.from('organizations').insert({
                    id: fallbackOrgId, name: orgName, slug: fallbackSlug,
                  });
                  await db.from('org_members').insert({
                    org_id: fallbackOrgId, user_id: user.id, role: 'owner',
                  });
                  await db.from('org_balances').insert({
                    org_id: fallbackOrgId, balance: 50,
                  });
                  await db.from('subscriptions').insert({
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    org_id: fallbackOrgId,
                    plan: 'basic',
                    tier: 'BASIC',
                    status: 'active',
                  });
                  await db.from('user_profiles').insert({
                    user_id: user.id,
                    display_name: user.name || null,
                    subscription_tier: 'BASIC',
                  });
                } catch (fallbackErr) {
                  logger.error('[databaseHook] org creation fallback failed', toError(fallbackErr));
                }
              }

              await grantSignupBonusCredits(user.id, 50);

              // Founder bootstrap if configured in FOUNDER_EMAIL (emailVerified required)
              const isEmailVerified = Boolean((user as unknown as { emailVerified?: boolean | number }).emailVerified);
              if (isEmailVerified) {
                await bootstrapFounderIfConfigured(user);
              } else {
                logger.info('[databaseHook] Founder bootstrap deferred: email not verified', undefined, {
                  userId: user.id,
                  email: user.email,
                });
              }
            } catch (err) {
              // Non-critical — org creation failure shouldn't block signup
              logger.error('[databaseHook] org creation failed', toError(err));
            }

            // Send welcome email (non-blocking)
            import('@/tree/email/sender').then(({ sendEmail }) => {
              sendEmail({
                to: user.email,
                subject: 'Welcome to Sophia AI Factory!',
                html: buildWelcomeHtml(user.name || user.email),
              }).catch(() => {});
            }).catch(() => {});
          },
        },
        update: {
          after: async (user) => {
            // Check if user was just verified, allowing deferred founder bootstrap
            const isEmailVerified = Boolean((user as unknown as { emailVerified?: boolean | number }).emailVerified);
            if (isEmailVerified) {
              await bootstrapFounderIfConfigured(user);
            }
          },
        },
      },
      account: {
        update: {
          after: async (account) => {
            try {
              if (account && account.userId && account.password) {
                await revokeAllUserSessions(account.userId);
                logger.info('[databaseHook] Account credentials changed; active sessions revoked', {
                  userId: account.userId,
                });
              }
            } catch (err) {
              logger.error('[databaseHook] Failed to revoke sessions on account update', toError(err));
            }
          },
        },
      },
    },
  }) as unknown as AuthInstance;

  return _auth;
}

function buildWelcomeHtml(nameOrEmail: string): string {
  const raw = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
  const name = escapeHtml(raw);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Welcome to Sophia AI Factory!</h2>
  <p>Hi ${name},</p>
  <p>Your account is ready. Here's how to get started:</p>
  <ol>
    <li>Set up your API keys in <a href="https://sophia.agencyos.network/dashboard/onboarding" style="color:#6750A4;">Onboarding</a></li>
    <li>Create your first AI video campaign</li>
    <li>Connect Telegram bot @Sophia_Bbot for mobile access</li>
  </ol>
  <p>Need help? Reply to this email, open the live-chat bubble on <a href="https://sophia.agencyos.network" style="color:#6750A4;">sophia.agencyos.network</a>, or message @Sophia_Bbot on Telegram.</p>
  <p style="color:#444;">Cần hỗ trợ? Trả lời email này, mở ô chat ở góc phải trang web, hoặc nhắn @Sophia_Bbot trên Telegram.</p>
  <p style="font-size:13px;color:#666;">Sophia AI Factory — AI-powered video production platform</p>
</body></html>`;
}

function buildMagicLinkHtml(rawUrl: string): string {
  // Sanitize URL to prevent XSS — only allow https URLs
  const url = rawUrl.startsWith('https://') || rawUrl.startsWith('http://localhost')
    ? rawUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;')
    : '#';
  // Bilingual template: EN block + VI block. Subject mirrors both languages.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Sign in to Sophia AI Factory</h2>
  <p>Click the button below to sign in. The link is valid for 15 minutes.</p>
  <a href="${url}" style="display:inline-block;background:#6750A4;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Sign In · Đăng Nhập</a>
  <p style="font-size:13px;color:#666;">If you did not request this email, please ignore it.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
  <h3 style="color:#6750A4;margin-bottom:8px;">Đăng nhập Sophia AI</h3>
  <p>Nhấn nút bên trên để đăng nhập. Link có hiệu lực trong 15 phút.</p>
  <p style="font-size:13px;color:#666;">Nếu bạn không yêu cầu email này, vui lòng bỏ qua.</p>
</body></html>`;
}
