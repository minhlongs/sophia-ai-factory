import { CANONICAL_TRUSTED_ORIGINS } from './types';
export {
  sanitizeAndResolveUserName,
  handleUserCreateBefore,
  provisionNewUser,
} from './user-provisioning';

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
