import { betterAuth } from 'better-auth';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { requireMfaIfEnabled, markSessionMfaPending } from '@/seed/auth/mfa/login-challenge';
import { getD1 } from '@/seed/db/client';
import { bootstrapFounderIfConfigured } from '@/seed/auth/founder-bootstrap';
import { hashPassword, verifyPassword } from '@/seed/security/password-hash';
import { revokeAllUserSessions } from '@/seed/auth/revoke-user-sessions';
import type { AuthInstance } from './types';
import {
  resolveBaseURL,
  resolveTrustedOrigins,
  sanitizeAndResolveUserName,
  provisionNewUser,
} from './d1-adapter-helpers';
import { createMagicLinkPlugin } from './plugin-configs';

let _auth: AuthInstance | null = null;

export function resetAuthForTesting(): void {
  _auth = null;
}

export async function getAuth(): Promise<AuthInstance> {
  if (_auth) return _auth;

  const d1 = await getD1();
  if (!d1) throw new Error('D1 database binding not available');
  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET or JWT_SECRET must be set');

  const baseURL = resolveBaseURL();
  const trustedOrigins = resolveTrustedOrigins(baseURL);

  _auth = betterAuth({
    database: d1,
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
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
      useSecureCookies: process.env.NODE_ENV !== 'development',
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: process.env.NODE_ENV !== 'development',
        httpOnly: true,
        path: '/',
      },
    },
    plugins: [createMagicLinkPlugin()],
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
            await provisionNewUser(user as { id: string; name?: string | null; email?: string | null });
          },
        },
        update: {
          after: async (user) => {
            const isEmailVerified = Boolean((user as unknown as { emailVerified?: boolean | number }).emailVerified);
            if (isEmailVerified) {
              await bootstrapFounderIfConfigured(user as Parameters<typeof bootstrapFounderIfConfigured>[0]);
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
