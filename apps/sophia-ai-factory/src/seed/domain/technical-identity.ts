/**
 * Technical Runtime Identity
 * Layer: seed
 *
 * Defines the stable Cloudflare Worker technical identity independent of
 * any customer-facing brand domain.
 *
 * @module seed/domain/technical-identity
 */

import type { DomainEnvLike, TechnicalRuntimeIdentity } from './types';

export const CLOUDFLARE_ACCOUNT_ID = 'f691e83094f776311a1bfe3f8b126f1c';
export const CLOUDFLARE_WORKERS_SUBDOMAIN = 'agencyos-openclaw';

export const PRODUCTION_WORKER_NAME = 'sophia-ai-factory';
export const PILOT_WORKER_NAME = 'sophia-ai-factory-pilot';

export const PRODUCTION_TECHNICAL_HOSTNAME = `${PRODUCTION_WORKER_NAME}.${CLOUDFLARE_WORKERS_SUBDOMAIN}.workers.dev`;
export const PILOT_TECHNICAL_HOSTNAME = `${PILOT_WORKER_NAME}.${CLOUDFLARE_WORKERS_SUBDOMAIN}.workers.dev`;

export const PRODUCTION_TECHNICAL_ORIGIN = `https://${PRODUCTION_TECHNICAL_HOSTNAME}`;
export const PILOT_TECHNICAL_ORIGIN = `https://${PILOT_TECHNICAL_HOSTNAME}`;

const PLACEHOLDER_MARKERS = ['REPLACE_WITH_', 'example.invalid', 'your-domain'];

function isUsableUrl(raw: string | undefined): raw is string {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (PLACEHOLDER_MARKERS.some((m) => trimmed.includes(m))) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isPilotEnvironment(env: DomainEnvLike = process.env): boolean {
  if (env.SOPHIA_PILOT_MODE === 'true' || env.SOPHIA_PILOT_MODE === '1') return true;
  if (env.PILOT_INVITE_ONLY === 'true') return true;
  if (env.CF_WORKER_NAME === PILOT_WORKER_NAME) return true;
  return false;
}

/**
 * Returns an explicit configured base URL (such as NEXT_PUBLIC_APP_URL) unless it is
 * empty, a template placeholder, or a production localhost value — in which case it
 * falls back to the validated runtime origin. Malformed/unsafe schemes are preserved
 * so downstream URL validators fail closed with an explicit error.
 */
export function resolveConfiguredBaseUrl(
  configuredUrl: string | undefined,
  fallbackOrigin: string,
  env: DomainEnvLike = process.env,
): string {
  const trimmed = configuredUrl?.trim();
  if (!trimmed) return fallbackOrigin;
  if (PLACEHOLDER_MARKERS.some((m) => trimmed.includes(m))) return fallbackOrigin;
  if (env.NODE_ENV === 'production') {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return fallbackOrigin;
      }
    } catch {
      // Preserve non-URL values so downstream validators reject them explicitly
    }
  }
  return trimmed;
}

export function getTechnicalRuntimeIdentity(
  env: DomainEnvLike = process.env,
): TechnicalRuntimeIdentity {
  const isPilot = isPilotEnvironment(env);
  const workerName =
    env.CF_WORKER_NAME?.trim() ||
    (isPilot ? PILOT_WORKER_NAME : PRODUCTION_WORKER_NAME);
  const accountId = env.CF_ACCOUNT_ID?.trim() || CLOUDFLARE_ACCOUNT_ID;
  const accountSubdomain =
    env.CF_WORKERS_SUBDOMAIN?.trim() || CLOUDFLARE_WORKERS_SUBDOMAIN;
  const technicalHostname = `${workerName}.${accountSubdomain}.workers.dev`.toLowerCase();
  const technicalOrigin = `https://${technicalHostname}`;

  let environment: TechnicalRuntimeIdentity['environment'] = 'production';
  if (isPilot) {
    environment = 'pilot';
  } else if (env.NODE_ENV !== 'production') {
    environment = 'development';
  }

  return {
    workerName,
    accountId,
    accountSubdomain,
    technicalHostname,
    technicalOrigin,
    deploymentSha: env.COMMIT_SHA?.trim() || null,
    environment,
  };
}

/**
 * Resolves the default public origin for server-side URL generation when no
 * incoming request context is available (e.g. cron jobs, background emails).
 *
 * Priority:
 * 1. Explicit runtime env (APP_URL -> BETTER_AUTH_URL -> NEXT_PUBLIC_APP_URL)
 * 2. Explicit WORKER_TECHNICAL_URL
 * 3. Cloudflare technical workers.dev origin for the active Worker
 *
 * Never falls back to an expiring brand domain.
 */
export function getDefaultPublicOrigin(env: DomainEnvLike = process.env): string {
  const isProduction = env.NODE_ENV === 'production';
  const candidates = [
    env.APP_URL,
    env.BETTER_AUTH_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.WORKER_TECHNICAL_URL,
  ];
  for (const candidate of candidates) {
    if (isUsableUrl(candidate)) {
      const parsed = new URL(candidate.trim());
      if (
        isProduction &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
      ) {
        continue;
      }
      return parsed.origin;
    }
  }
  return getTechnicalRuntimeIdentity(env).technicalOrigin;
}
