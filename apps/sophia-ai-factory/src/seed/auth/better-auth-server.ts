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
import { requireMfaIfEnabled, markSessionMfaPending } from '@/seed/auth/mfa/login-challenge';
import { escapeHtml } from '@/seed/security/input-sanitization-utilities';
import { getD1, createServerClient } from '@/seed/db/client';


// Use `any` here to escape Better Auth's deeply-nested generic inference. The
// public surface (`getAuth()` return + `getCurrentUser()` consumers) re-narrows
// at call sites via the better-auth-session helper.
type AuthInstance = ReturnType<typeof betterAuth>;
let _auth: AuthInstance | null = null;

/**
 * Get the Better Auth instance (lazy singleton per isolate).
 * Safe to call in request handlers — D1 is available at that point.
 */
export function getAuth() {
  if (_auth) return _auth;

  const d1 = getD1();
  if (!d1) throw new Error('D1 database binding not available');
  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET or JWT_SECRET must be set');

  // Better Auth's deep generic inference produces a narrower Auth<...> than
  // the default `Auth<BetterAuthOptions>` carried by `ReturnType<typeof betterAuth>`.
  // Two structurally-equivalent Prettify types appear in the diagnostic, so we
  // cast to the parent type to break the inference loop.
  _auth = betterAuth({
    database: d1,
    secret,
    baseURL: process.env.BETTER_AUTH_URL
      || process.env.APP_URL
      || 'https://sophia.agencyos.network',
    basePath: '/api/auth',
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      password: {
        hash: async (password: string) => {
          const { hashPassword } = await import('@/tree/crypto/password-hash');
          return hashPassword(password);
        },
        verify: async ({ hash, password }: { hash: string; password: string }) => {
          const { verifyPassword } = await import('@/tree/crypto/password-hash');
          return verifyPassword(password, hash);
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
          const { sendEmail } = await import('@/forest/email/sender');
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
          after: async (session) => {
            try {
              const { required } = await requireMfaIfEnabled(session.userId);
              if (required) {
                await markSessionMfaPending(session.id);
              }
            } catch (err) {
              // Non-blocking — log but don't prevent session creation
              logger.error('[databaseHook] MFA pending check failed', err instanceof Error ? err : new Error(String(err)));
            }
          },
        },
      },
      user: {
        create: {
          after: async (user) => {
            try {
              const db = createServerClient();
              if (!db) throw new Error('D1 database binding not available');
              const orgId = crypto.randomUUID();
              const prefix = user.email.split('@')[0]
                .replace(/[^a-z0-9]/gi, '-').toLowerCase();
              const slug = `${prefix}-${orgId.slice(0, 6)}`;
              await db.from('organizations').insert({
                id: orgId, name: user.email, slug,
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

const { addCredits } = await import('@/land/mcu/credits-repo');
try {
await addCredits(user.id, 50, 'Signup Bonus');
} catch (creditErr) {
logger.warn('[databaseHook] signup bonus credits failed', creditErr instanceof Error ? creditErr : new Error(String(creditErr)));
}
            } catch (err) {
              // Non-critical — org creation failure shouldn't block signup
              logger.error('[databaseHook] org creation failed', err instanceof Error ? err : new Error(String(err)));
            }

            // Send welcome email (non-blocking)
            import('@/forest/email/sender').then(({ sendEmail }) => {
              sendEmail({
                to: user.email,
                subject: 'Welcome to Sophia AI Factory!',
                html: buildWelcomeHtml(user.name || user.email),
              }).catch(() => {});
            }).catch(() => {});
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
