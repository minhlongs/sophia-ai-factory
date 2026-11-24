/**
 * Public Request Origin Validation & Fail-Closed Host Guard
 * Layer: seed
 *
 * Strictly validates incoming Host and X-Forwarded-Host headers against the
 * exact allowlist (technical workers.dev + Env ALLOWED_HOSTS + Active D1
 * Brand Domains). Unknown or spoofed hosts fail closed with HTTP 421.
 *
 * @module seed/domain/public-request-origin
 */

import { NextResponse } from 'next/server';
import {
  getDefaultPublicOrigin,
  getTechnicalRuntimeIdentity,
} from './technical-identity';
import {
  getDynamicActiveHosts,
  getStaticAllowedHosts,
  isValidExactHostname,
  normalizeExactHostname,
} from './host-allowlist';
import type {
  DomainEnvLike,
  OriginResolutionSource,
  PublicRequestOrigin,
} from './types';

function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function parseRawHostHeader(raw: string | null): { hostname: string; port: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || /[\s\r\n*@/,]/.test(trimmed)) return null;

  let hostname = trimmed;
  let port = '';
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx !== -1) {
    port = trimmed.slice(colonIdx + 1);
    const portNum = Number(port);
    if (!/^[1-9]\d{0,4}$/.test(port) || portNum < 1 || portNum > 65535) return null;
    hostname = trimmed.slice(0, colonIdx);
  }

  const normalized = normalizeExactHostname(hostname);
  if (!normalized || !isValidExactHostname(normalized)) return null;
  return { hostname: normalized, port };
}

function classifyAllowedHost(
  hostname: string,
  env: DomainEnvLike,
): OriginResolutionSource | null {
  const identity = getTechnicalRuntimeIdentity(env);
  if (hostname === identity.technicalHostname) return 'technical';

  if (env.NODE_ENV !== 'production' && isLocalDevHost(hostname)) {
    return 'local-dev';
  }

  const staticAllowed = getStaticAllowedHosts(env);
  if (staticAllowed.has(hostname)) return 'env-allowlist';

  if (getDynamicActiveHosts().has(hostname)) return 'brand-registry';

  return null;
}

/**
 * Resolves and strictly validates the public origin of an incoming request.
 *
 * Security invariants:
 * - Rejects malformed, multi-value, or wildcard Host / X-Forwarded-Host headers.
 * - If X-Forwarded-Host is present, it MUST be a single exact allowlisted host;
 *   an untrusted X-Forwarded-Host fails closed even if Host is valid.
 * - Production always requires https: protocol (no plaintext downgrade).
 * - Never returns an unvalidated client-supplied host.
 */
export function resolvePublicRequestOrigin(
  request: Request,
  env: DomainEnvLike = process.env,
): PublicRequestOrigin | null {
  const rawForwarded = request.headers.get('x-forwarded-host');
  const rawHost = request.headers.get('host');

  let parsedHost: { hostname: string; port: string } | null = null;

  if (rawForwarded !== null) {
    // Reject comma-separated proxy chains or spoofed forwarded hosts
    parsedHost = parseRawHostHeader(rawForwarded);
    if (!parsedHost) return null;
  }

  const parsedHostHeader = rawHost !== null ? parseRawHostHeader(rawHost) : null;
  if (rawHost !== null && !parsedHostHeader) {
    return null;
  }

  if (parsedHost && parsedHostHeader && parsedHost.hostname !== parsedHostHeader.hostname) {
    // Both headers present with different hosts: both must be allowlisted
    // (e.g. Cloudflare routing from custom domain to worker), otherwise reject spoofing.
    const hostSource = classifyAllowedHost(parsedHostHeader.hostname, env);
    if (!hostSource) return null;
  }

  let effective = parsedHost ?? parsedHostHeader;
  if (!effective) {
    try {
      const url = new URL(request.url);
      effective = parseRawHostHeader(url.host);
    } catch {
      return null;
    }
  }
  if (!effective) return null;

  const source = classifyAllowedHost(effective.hostname, env);
  if (!source) return null;

  const isLocal = isLocalDevHost(effective.hostname);
  const isProd = env.NODE_ENV === 'production';

  // Reject non-standard ports in production to prevent Host header port injection
  if (isProd && effective.port && effective.port !== '443') {
    return null;
  }

  const rawProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  let protocol: 'https:' | 'http:' = 'https:';
  if (isLocal && !isProd) {
    protocol = rawProto === 'https' ? 'https:' : 'http:';
  } else if (rawProto === 'http' && isProd) {
    // Never generate plaintext http origins in production
    protocol = 'https:';
  }

  const includePort =
    !isProd &&
    isLocal &&
    Boolean(effective.port) &&
    !((protocol === 'https:' && effective.port === '443') ||
      (protocol === 'http:' && effective.port === '80'));
  const hostWithPort = includePort
    ? `${effective.hostname}:${effective.port}`
    : effective.hostname;

  return {
    origin: `${protocol}//${hostWithPort}`,
    hostname: effective.hostname,
    protocol,
    source,
  };
}

/**
 * Fail-closed guard for middleware & API entrypoints.
 * Returns HTTP 421 Misdirected Request if the request's Host or
 * X-Forwarded-Host is not in the exact allowlist.
 */
export function enforceAllowedRequestHost(
  request: Request,
  env: DomainEnvLike = process.env,
): NextResponse | null {
  const resolved = resolvePublicRequestOrigin(request, env);
  if (resolved) return null;

  return NextResponse.json(
    {
      error: 'Host not allowed',
      code: 'HOST_NOT_ALLOWED',
    },
    {
      status: 421,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

/**
 * Returns the validated public origin for the current request, or falls back
 * to the Worker's configured default public origin (never an untrusted header).
 */
export function getSafeOriginFromRequest(
  request: Request | null | undefined,
  env: DomainEnvLike = process.env,
): string {
  if (request) {
    const resolved = resolvePublicRequestOrigin(request, env);
    if (resolved) return resolved.origin;
  }
  return getDefaultPublicOrigin(env);
}
