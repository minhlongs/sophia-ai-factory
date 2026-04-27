/**
 * Better Auth server configuration — D1 Kysely adapter.
 *
 * Replaces custom JWT auth with Better Auth framework.
 * Uses lazy initialization to avoid D1 binding issues at build time.
 */

import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { hashPassword, verifyPassword } from '@/lib/crypto/password-hash';
import { sendEmail } from '@/lib/email/sender';
import { getD1Client } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

/** Resolve D1 binding from CF Workers context */
function getD1(): D1Database {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;

  const ctxSymbol = Symbol.for('__cloudflare-context__');
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol];
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  throw new Error('D1 database binding not available');
}

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
      || process.env.NEXT_PUBLIC_APP_URL
      || 'https://sophia.agencyos.network',
    basePath: '/api/auth',
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      password: {
        hash: hashPassword,
        verify: async ({ hash, password }: { hash: string; password: string }) => {
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
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendEmail({
            to: email,
            subject: 'Sign in to Sophia AI Factory',
            html: buildMagicLinkHtml(url),
          });
        },
        expiresIn: 900,
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              const db = await getD1Client();
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
            } catch (err) {
              // Non-critical — org creation failure shouldn't block signup
              logger.error('[databaseHook] org creation failed', err instanceof Error ? err : new Error(String(err)));
            }

            // Send welcome email (non-blocking)
            import('@/lib/email/sender').then(({ sendEmail }) => {
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
  const name = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Welcome to Sophia AI Factory!</h2>
  <p>Hi ${name},</p>
  <p>Your account is ready. Here's how to get started:</p>
  <ol>
    <li>Set up your API keys in <a href="https://sophia.agencyos.network/setup-wizard" style="color:#6750A4;">Settings</a></li>
    <li>Create your first AI video campaign</li>
    <li>Connect Telegram bot @Sophia_Bbot for mobile access</li>
  </ol>
  <p>Need help? Reply to this email or message @Sophia_Bbot on Telegram.</p>
  <p style="font-size:13px;color:#666;">Sophia AI Factory — AI-powered video production platform</p>
</body></html>`;
}

function buildMagicLinkHtml(rawUrl: string): string {
  // Sanitize URL to prevent XSS — only allow https URLs
  const url = rawUrl.startsWith('https://') || rawUrl.startsWith('http://localhost')
    ? rawUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;')
    : '#';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Đăng nhập Sophia AI</h2>
  <p>Nhấn nút bên dưới để đăng nhập. Link có hiệu lực trong 15 phút.</p>
  <a href="${url}" style="display:inline-block;background:#6750A4;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Đăng Nhập</a>
  <p style="font-size:13px;color:#666;">Nếu bạn không yêu cầu email này, vui lòng bỏ qua.</p>
</body></html>`;
}
