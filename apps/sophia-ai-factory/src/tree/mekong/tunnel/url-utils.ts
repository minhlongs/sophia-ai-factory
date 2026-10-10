export const DEFAULT_TIMEOUT_MS = 2500;
export const MIN_PROBE_TIMEOUT_MS = 500;

/**
 * Validates whether a tunnel URL conforms to allowed Cloudflare Tunnel formats.
 */
export function isValidTunnelUrl(url: string, allowLocal = false): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'https:') {
      return parsed.hostname.length > 0;
    }
    if (allowLocal && parsed.protocol === 'http:') {
      return (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.endsWith('.localhost')
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if a tunnel URL matches the canonical `*.cashclaw.cc` wildcard domain.
 */
export function isCashclawTunnelUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.cashclaw.cc');
  } catch {
    return false;
  }
}

/**
 * Strips trailing slashes and trims whitespace from tunnel URLs.
 */
export function normalizeTunnelUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
}

/**
 * Creates an AbortSignal that aborts after timeoutMs.
 */
export function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(timeoutMs), cleanup: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Tunnel request timed out')), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}
