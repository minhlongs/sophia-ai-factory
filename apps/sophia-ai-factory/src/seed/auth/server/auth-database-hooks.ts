/**
 * Database lifecycle hooks and password policy for Better Auth instance.
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { requireMfaIfEnabled, markSessionMfaPending } from '@/seed/auth/mfa/login-challenge';
import { bootstrapFounderIfConfigured } from '@/seed/auth/founder-bootstrap';
import { revokeAllUserSessions } from '@/seed/auth/revoke-user-sessions';
import { sanitizeAndResolveUserName, provisionNewUser } from './d1-adapter-helpers';

export function validatePasswordStrength(password: string): { success: boolean; message?: string } {
  const issues: string[] = [];
  if (password.length < 8) issues.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) issues.push('one uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('one lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('one number');
  if (issues.length > 0) {
    return { success: false, message: `Password requires: ${issues.join(', ')}` };
  }
  return { success: true };
}

export const authDatabaseHooks = {
  session: {
    create: {
      before: async (session: { id: string; userId: string }) => {
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
      before: async (user: { name?: string | null; email: string } & Record<string, unknown>) => {
        const name = sanitizeAndResolveUserName(user.name, user.email);
        return { data: { ...user, name } };
      },
      after: async (user: { id: string; name?: string | null; email?: string | null }) => {
        await provisionNewUser(user);
      },
    },
    update: {
      after: async (user: unknown) => {
        const isEmailVerified = Boolean(
          (user as { emailVerified?: boolean | number }).emailVerified,
        );
        if (isEmailVerified) {
          await bootstrapFounderIfConfigured(
            user as Parameters<typeof bootstrapFounderIfConfigured>[0],
          );
        }
      },
    },
  },
  account: {
    update: {
      after: async (account: { userId?: string; password?: string | null } | null) => {
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
};
