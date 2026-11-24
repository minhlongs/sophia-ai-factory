import {
  getDefaultPublicOrigin,
  getEffectiveAllowedHosts,
  getTechnicalRuntimeIdentity,
  isValidExactHostname,
  normalizeExactHostname,
} from '@/seed/domain';
import { LOCAL_DEV_TRUSTED_ORIGINS } from './types';

export {
  sanitizeAndResolveUserName,
  handleUserCreateBefore,
  provisionNewUser,
} from './user-provisioning';

function getMergedRuntimeEnv(): Record<string, string | undefined> {
  const globalEnv = (
    globalThis as unknown as { __env__?: Record<string, unknown> }
  )?.__env__;
  const merged: Record<string, string | undefined> = { ...process.env };
  if (globalEnv) {
    for (const key of [
      'BETTER_AUTH_URL',
      'APP_URL',
      'NEXT_PUBLIC_APP_URL',
      'WORKER_TECHNICAL_URL',
      'ALLOWED_HOSTS',
      'TRUSTED_ORIGINS',
      'BETTER_AUTH_TRUSTED_ORIGINS',
      'CF_WORKER_NAME',
      'SOPHIA_PILOT_MODE',
    ]) {
      const value = globalEnv[key];
      if (typeof value === 'string' && value.trim()) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

export function resolveBaseURL(): string {
  const env = getMergedRuntimeEnv();
  const isProduction = env.NODE_ENV === 'production';
  const envAuthUrl = env.BETTER_AUTH_URL || env.APP_URL || env.NEXT_PUBLIC_APP_URL;
  const isLocalEnvUrl = Boolean(
    envAuthUrl &&
      (envAuthUrl.includes('localhost') || envAuthUrl.includes('127.0.0.1')),
  );

  if (isProduction) {
    if (envAuthUrl && !isLocalEnvUrl && !envAuthUrl.includes('REPLACE_WITH_')) {
      return envAuthUrl.replace(/\/+$/, '');
    }
    return getDefaultPublicOrigin(env);
  }

  return (envAuthUrl || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Resolves the exact list of allowed hostnames for Better Auth dynamic baseURL.
 * Never includes wildcards; combines technical workers.dev, Env ALLOWED_HOSTS,
 * and active runtime brand domains.
 */
export function resolveAllowedAuthHosts(): string[] {
  const env = getMergedRuntimeEnv();
  const hosts = getEffectiveAllowedHosts(env);
  const identity = getTechnicalRuntimeIdentity(env);
  hosts.add(identity.technicalHostname);
  return Array.from(hosts);
}

/**
 * Resolves exact trusted origins for Better Auth CSRF & Origin validation.
 * Rejects wildcards (`*`) and malformed entries; only emits exact origins.
 */
export function resolveTrustedOrigins(customBaseURL?: string): string[] {
  const env = getMergedRuntimeEnv();
  const base = customBaseURL || resolveBaseURL();
  const isProduction = env.NODE_ENV === 'production';
  const originsSet = new Set<string>();

  // Every exact allowed host is a trusted HTTPS origin
  for (const host of resolveAllowedAuthHosts()) {
    if (host === 'localhost' || host === '127.0.0.1') {
      if (!isProduction) {
        originsSet.add(`http://${host}:3000`);
        originsSet.add(`http://${host}:8787`);
      }
      continue;
    }
    originsSet.add(`https://${host}`);
  }

  if (!isProduction) {
    for (const localOrigin of LOCAL_DEV_TRUSTED_ORIGINS) {
      originsSet.add(localOrigin);
    }
  }

  const explicitCandidates = [
    base,
    env.BETTER_AUTH_URL,
    env.APP_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.WORKER_TECHNICAL_URL,
    ...(env.TRUSTED_ORIGINS ? env.TRUSTED_ORIGINS.split(',') : []),
    ...(env.BETTER_AUTH_TRUSTED_ORIGINS
      ? env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
      : []),
  ];

  for (const candidate of explicitCandidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim().replace(/\/+$/, '');
    if (!trimmed || trimmed.includes('*') || trimmed.includes('REPLACE_WITH_')) {
      continue;
    }
    try {
      const parsed = new URL(trimmed);
      const isHttps = parsed.protocol === 'https:';
      const isAllowedDevHttp =
        !isProduction &&
        parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
      if (!isHttps && !isAllowedDevHttp) continue;
      const normalized = normalizeExactHostname(parsed.hostname);
      if (normalized && isValidExactHostname(normalized)) {
        originsSet.add(parsed.origin);
      }
    } catch {
      // Ignore malformed origin entries (fail-closed)
    }
  }

  return Array.from(originsSet);
}
