/**
 * Strict Hostname Allowlist & Runtime Brand Domain Cache
 * Layer: seed
 *
 * Combines:
 * - Layer 1: Worker technical workers.dev hostname + Env ALLOWED_HOSTS
 * - Layer 2: Active brand domains synced from D1 (with bounded TTL)
 *
 * Enforces exact hostname matching only — no wildcards, no arbitrary hosts.
 *
 * @module seed/domain/host-allowlist
 */

import { getTechnicalRuntimeIdentity } from './technical-identity';
import type { DomainEnvLike } from './types';

const PLACEHOLDER_MARKERS = ['REPLACE_WITH_', 'example.invalid', 'your-domain'];
const LOCAL_DEV_HOSTS: readonly string[] = ['localhost', '127.0.0.1'];

// Strict RFC-1123 hostname without wildcards, ports, paths, or whitespace
const EXACT_HOSTNAME_REGEX =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const DYNAMIC_HOST_CACHE_TTL_MS = 30_000;

let dynamicActiveHosts: Set<string> = new Set();
let dynamicCacheExpiresAt = 0;
const syncListeners = new Set<(hosts: readonly string[]) => void>();

export function normalizeExactHostname(raw: string | null | undefined): string {
  if (!raw) return '';
  let value = raw.trim().toLowerCase();
  if (!value) return '';

  // Reject CRLF, whitespace, wildcards, or userinfo injection immediately
  if (/[\s\r\n*@]/.test(value)) return '';

  // Strip optional scheme if a URL was passed to an env var parser
  if (value.startsWith('https://')) value = value.slice(8);
  else if (value.startsWith('http://')) value = value.slice(7);

  // Strip path if present
  const slashIdx = value.indexOf('/');
  if (slashIdx !== -1) return '';

  // Strip port only if strictly numeric
  const colonIdx = value.indexOf(':');
  if (colonIdx !== -1) {
    const portPart = value.slice(colonIdx + 1);
    if (!/^\d{1,5}$/.test(portPart)) return '';
    value = value.slice(0, colonIdx);
  }

  // Reject trailing dots or empty labels
  if (value.endsWith('.') || value.startsWith('.') || value.includes('..')) {
    return '';
  }

  return value;
}

export function isValidExactHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (PLACEHOLDER_MARKERS.some((m) => hostname.includes(m.toLowerCase()))) {
    return false;
  }
  return EXACT_HOSTNAME_REGEX.test(hostname);
}

function extractHostFromUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  const lowered = trimmed.toLowerCase();
  if (!trimmed || PLACEHOLDER_MARKERS.some((m) => lowered.includes(m.toLowerCase()))) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return isValidExactHostname(host) ? host : null;
  } catch {
    return null;
  }
}

export function getStaticAllowedHosts(env: DomainEnvLike = process.env): Set<string> {
  const allowed = new Set<string>();
  const identity = getTechnicalRuntimeIdentity(env);
  allowed.add(identity.technicalHostname);

  // Explicit comma-separated ALLOWED_HOSTS env var
  const rawAllowedHosts = env.ALLOWED_HOSTS;
  if (rawAllowedHosts) {
    for (const entry of rawAllowedHosts.split(',')) {
      const normalized = normalizeExactHostname(entry);
      if (normalized && isValidExactHostname(normalized)) {
        allowed.add(normalized);
      }
    }
  }

  // Configured runtime URLs (never wildcard, always exact hostname)
  for (const urlVar of [
    env.APP_URL,
    env.BETTER_AUTH_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.WORKER_TECHNICAL_URL,
  ]) {
    const host = extractHostFromUrl(urlVar);
    if (host) allowed.add(host);
  }

  // Explicit TRUSTED_ORIGINS env var (comma-separated origins)
  if (env.TRUSTED_ORIGINS) {
    for (const originEntry of env.TRUSTED_ORIGINS.split(',')) {
      const host = extractHostFromUrl(originEntry);
      if (host) allowed.add(host);
    }
  }

  // Local development hosts are permitted ONLY outside production
  if (env.NODE_ENV !== 'production') {
    for (const localHost of LOCAL_DEV_HOSTS) {
      allowed.add(localHost);
    }
  }

  return allowed;
}

export function onAllowedHostsUpdated(
  listener: (hosts: readonly string[]) => void,
): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function registerDynamicActiveHosts(
  hostnames: readonly string[],
  ttlMs: number = DYNAMIC_HOST_CACHE_TTL_MS,
): void {
  const next = new Set<string>();
  for (const raw of hostnames) {
    const normalized = normalizeExactHostname(raw);
    if (
      normalized &&
      normalized !== 'localhost' &&
      normalized !== '127.0.0.1' &&
      isValidExactHostname(normalized)
    ) {
      next.add(normalized);
    }
  }
  dynamicActiveHosts = next;
  dynamicCacheExpiresAt = Date.now() + ttlMs;

  const effective = [...getEffectiveAllowedHosts()];
  for (const listener of syncListeners) {
    listener(effective);
  }
}

export function isDynamicHostCacheFresh(): boolean {
  return Date.now() < dynamicCacheExpiresAt;
}

export function getDynamicActiveHosts(): ReadonlySet<string> {
  if (!isDynamicHostCacheFresh()) {
    return new Set();
  }
  return dynamicActiveHosts;
}

export function invalidateDynamicHostCache(): void {
  dynamicActiveHosts = new Set();
  dynamicCacheExpiresAt = 0;
  const effective = [...getEffectiveAllowedHosts()];
  for (const listener of syncListeners) {
    listener(effective);
  }
}

export function resetDynamicHostRegistryForTests(): void {
  dynamicActiveHosts = new Set();
  dynamicCacheExpiresAt = 0;
}

export function getEffectiveAllowedHosts(env: DomainEnvLike = process.env): Set<string> {
  const combined = getStaticAllowedHosts(env);
  for (const host of getDynamicActiveHosts()) {
    combined.add(host);
  }
  return combined;
}

export function isHostAllowed(
  rawHost: string | null | undefined,
  env: DomainEnvLike = process.env,
): boolean {
  const normalized = normalizeExactHostname(rawHost);
  if (!normalized || !isValidExactHostname(normalized)) return false;
  return getEffectiveAllowedHosts(env).has(normalized);
}
