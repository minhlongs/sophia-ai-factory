import { betterAuth } from 'better-auth';
import { getD1 } from '@/seed/db/client';
import { onAllowedHostsUpdated } from '@/seed/domain';
import { hashPassword, verifyPassword } from '@/seed/security/password-hash';
import type { AuthInstance } from './types';
import {
  resolveAllowedAuthHosts,
  resolveBaseURL,
  resolveTrustedOrigins,
} from './d1-adapter-helpers';
import { createMagicLinkPlugin } from './plugin-configs';
import {
  createPasskeyPlugin,
  createEmailOtpPlugin,
  createTwoFactorPlugin,
} from './passkey-and-otp-plugins';
import { authDatabaseHooks, validatePasswordStrength } from './auth-database-hooks';

let _auth: AuthInstance | null = null;
const _dynamicAllowedHosts: string[] = [];
let _unsubscribeHosts: (() => void) | null = null;

/**
 * Synchronizes Better Auth's dynamic allowedHosts array in-place so newly
 * activated brand domains are accepted immediately without rebuilding or
 * recreating the Worker auth singleton.
 */
export function syncAuthAllowedHosts(hosts: readonly string[]): void {
  const unique = Array.from(new Set(hosts));
  _dynamicAllowedHosts.splice(0, _dynamicAllowedHosts.length, ...unique);
}

export function resetAuthForTesting(): void {
  _auth = null;
  _dynamicAllowedHosts.length = 0;
  if (_unsubscribeHosts) {
    _unsubscribeHosts();
    _unsubscribeHosts = null;
  }
}

export async function getAuth(): Promise<AuthInstance> {
  // Always refresh allowedHosts before returning singleton so runtime env or
  // D1 brand-domain updates take effect immediately.
  syncAuthAllowedHosts(resolveAllowedAuthHosts());
  if (_auth) return _auth;

  const d1 = await getD1();
  if (!d1) throw new Error('D1 database binding not available');
  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET or JWT_SECRET must be set');

  const fallbackBaseURL = resolveBaseURL();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!_unsubscribeHosts) {
    _unsubscribeHosts = onAllowedHostsUpdated(() => {
      syncAuthAllowedHosts(resolveAllowedAuthHosts());
    });
  }

  _auth = betterAuth({
    database: d1,
    secret,
    baseURL: {
      allowedHosts: _dynamicAllowedHosts,
      fallback: fallbackBaseURL,
      protocol: isProduction ? 'https' : 'auto',
    },
    basePath: '/api/auth',
    trustedOrigins: async () => resolveTrustedOrigins(fallbackBaseURL),
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
        role: {
          type: 'string',
          required: false,
          defaultValue: 'user',
          input: false,
        },
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
      createPasskeyPlugin(),
      createEmailOtpPlugin(),
      createTwoFactorPlugin(),
      createMagicLinkPlugin(),
    ],
    databaseHooks: authDatabaseHooks,
  }) as unknown as AuthInstance;

  return _auth;
}
