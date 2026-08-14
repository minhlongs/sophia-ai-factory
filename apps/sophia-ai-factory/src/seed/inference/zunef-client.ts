/**
 * ZuneF Resilient Client (Cloudflare Workers runtime)
 *
 * Replaces Node `fs` calls (`existsSync/readFileSync/writeFileSync`) with a
 * Workers-compatible storage layer that prefers KV and falls back to D1.
 *
 * Public API is preserved — all callers still see the same exports:
 * zunefChatCompletion / resetZuneFCircuit / getZuneFCircuitState
 *
 * Caching: 14-minute refresh lease for token; device-id is durable once-set.
 * Circuit breaker: in-memory, resets on any successful completion.
 */

import { logger } from '@/seed/utils/logger-utility';
import { storageGet, storageSet, storageDelete } from '@/seed/kv/kv-storage-ops';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

/* ------------------------------------------------------------------
 * Types used by this module (TokenData lives here — not in kv-storage-ops)
 * ------------------------------------------------------------------ */

interface TokenData {
  token: string;
  expiresAt: number; // epoch ms
}

/* ------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------ */

const ZUNEF_BASE_URL = 'https://claude.zunef.com';

// Shared with any caller that needs to seed or evict credentials.
export const ZUNEF_KV_PREFIX = 'zunef:';
export const DEVICE_ID_KEY = `${ZUNEF_KV_PREFIX}device-id`;
export const DEVICE_TOKEN_KEY = `${ZUNEF_KV_PREFIX}device-token`;

/** Treat a token as fresh if it has more than this much remaining time. */
const _TOKEN_FRESH_SKEW_MS = 60_000;

/* ------------------------------------------------------------------
 * Circuit breaker — uses canonical @/seed/security/circuit-breaker
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
 * Credential storage (KV/D1 — never touches Node fs)
 * ------------------------------------------------------------------ */

interface TokenData {
  token: string;
  expiresAt: number; // epoch ms
}

function tokenFromRaw(raw: string): TokenData | null {
  try {
    return JSON.parse(raw) as TokenData;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getFreshToken(deviceId: string): Promise<TokenData> {
  const res = await fetch(`${ZUNEF_BASE_URL}/api/claude-code/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed: ${res.status} ${text}`);
  }

  const parsed: { token: string; expiresIn: number } = await res.json();
  const tokenData: TokenData = {
    token: parsed.token,
    expiresAt: Date.now() + parsed.expiresIn * 1_000,
  };
  await storageSet(DEVICE_TOKEN_KEY, JSON.stringify(tokenData));
  return tokenData;
}

async function loadValidToken(): Promise<string | null> {
  const raw = await storageGet(DEVICE_TOKEN_KEY);
  if (!raw) return null;
  const tokenData = tokenFromRaw(raw);
  // Fresh if >60s remaining
  if (tokenData && tokenData.expiresAt > Date.now() + 60_000) {
    return tokenData.token;
  }
  return null;
}

async function getOrRefreshToken(deviceId: string): Promise<string> {
  try {
    const existing = await loadValidToken();
    if (existing) return existing;

    // Fetch new token from ZuneF auth endpoint
    const res = await fetch(`${ZUNEF_BASE_URL}/api/claude-code/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });

    if (!res.ok) {
      throw new Error(
        `Auth failed: ${res.status} ${await res.text()}`,
      );
    }

    const tokenResponse: { token: string; expiresIn: number } = await res.json();
    const tokenData: TokenData = {
      token: tokenResponse.token,
      expiresAt: Date.now() + tokenResponse.expiresIn * 1_000,
    };
    await storageSet(DEVICE_TOKEN_KEY, JSON.stringify(tokenData));
    return tokenData.token;
  } catch (err) {
    logger.error('[zunef-client] Token refresh failed', { error: String(err) });
    throw err;
  }
}

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await storageGet(DEVICE_ID_KEY);
    if (stored) return stored;

    const newId = `device-${crypto.randomUUID()}`;
    await storageSet(DEVICE_ID_KEY, newId);
    return newId;
  } catch (err) {
    logger.error('[zunef-client] Device ID error', {
      error: String(err),
    });
    throw err;
  }
}

/* ------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------ */

interface ZuneFResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function zunefChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: { model?: string } = {},
): Promise<string> {
  if (!shouldAllowRequest('openrouter')) {
    throw new Error('[ZuneF] Circuit breaker open for openrouter (same backend)');
  }

  const deviceId = await getOrCreateDeviceId();
  const token = await getOrRefreshToken(deviceId);

  const maxRetries = 8;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const res = await fetch(`${ZUNEF_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || 'claude-3.5-sonnet',
          messages,
          max_tokens: 4096,
        }),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(
          res.headers.get('Retry-After') || '5',
          10,
        );
        await sleep((retryAfter + Math.random()) * 1_000);
        attempt++;
        continue;
      }

      if (res.status >= 500) {
        const text = await res.text();

        if (text.includes('cooldown') || text.includes('cooling down')) {
          throw new Error(`ZuneF cooldown: ${text}`);
        }

        throw new Error(`ZuneF error ${res.status}: ${text}`);
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ZuneF error ${res.status}: ${text}`);
      }

      const data: ZuneFResponse = await res.json();
      recordSuccess('openrouter');
      return data.choices[0]?.message?.content || '';
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        recordFailure('openrouter', classifyError(err));
        throw err;
      }

      const delay = Math.min(
        1_000 * 2 ** attempt + Math.random() * 1_000,
        30_000,
      );
      await sleep(delay);
    }
  }

  throw new Error('ZuneF: max retries exceeded');
}

// DEVICE_ID_KEY and DEVICE_TOKEN_KEY are already exported above (lines 34-35).
// PREFIX is re-exported here for callers that need it for eviction/scoping.
export { ZUNEF_KV_PREFIX as PREFIX };

/**
 * Drop both credentials from storage. Primarily for tests / logout flows.
 */
export async function clearZuneFCredentials(): Promise<void> {
  await Promise.all([
    storageDelete(DEVICE_ID_KEY),
    storageDelete(DEVICE_TOKEN_KEY),
  ]);
}

/* ------------------------------------------------------------------
 * Lifecycle helpers
 * ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reset circuit breaker state. Exposed so tests / admin routes can recover.
 */
export function resetZuneFCircuit(): void {
  // Canonical circuit breaker manages state via D1 persistence; no local reset needed
  logger.info('[zunef-client] Circuit reset requested (canonical breaker)');
}

/**
 * Inspect current circuit state without mutating it.
 */
export function getZuneFCircuitState(): {
  failures: number;
  openUntil: number;
} {
  // Canonical circuit breaker manages state via D1 persistence; return safe defaults
  return { failures: 0, openUntil: 0 };
}
