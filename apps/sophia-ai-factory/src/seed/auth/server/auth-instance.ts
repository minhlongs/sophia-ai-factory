import { betterAuth } from 'better-auth';
import { getD1 } from '@/seed/db/client';
import { hashPassword, verifyPassword } from '@/seed/security/password-hash';
import type { AuthInstance } from './types';
import { resolveBaseURL, resolveTrustedOrigins } from './d1-adapter-helpers';
import { createMagicLinkPlugin } from './plugin-configs';
import {
  createPasskeyPlugin,
  createEmailOtpPlugin,
  createTwoFactorPlugin,
} from './passkey-and-otp-plugins';
import { authDatabaseHooks, validatePasswordStrength } from './auth-database-hooks';

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
        verify: ({ hash, password }: { hash: string; password: string }) =>
          verifyPassword(password, hash),
        validate: validatePasswordStrength,
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
    plugins: [
      createPasskeyPlugin(baseURL),
      createEmailOtpPlugin(),
      createTwoFactorPlugin(),
      createMagicLinkPlugin(),
    ],
    databaseHooks: authDatabaseHooks,
  }) as unknown as AuthInstance;

  return _auth;
}
