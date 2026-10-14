/**
 * Rolling mismatch window, thresholds, and signature header parsers for /api/canary/webhook.
 * @module app/api/canary/webhook/canary-webhook-helpers
 */

/** Alert thresholds exposed to external monitors (Better Stack / Pingdom). */
export const THRESHOLDS = {
  /** Maximum acceptable HMAC-mismatch rate (%) over the rolling window. */
  hmacMismatchRatePctMax: 1.0,
  /** Maximum acceptable p95 latency in ms (self-reported via X-Request-Latency if present). */
  latencyP95MsMax: 500,
} as const;

export const WINDOW_SEC = 300; // 5 min

interface MismatchWindow {
  windowStart: number; // unix seconds
  total: number;
  mismatches: number;
}

let mismatchWindow: MismatchWindow = { windowStart: 0, total: 0, mismatches: 0 };

function advanceWindowIfNeeded(nowSec: number): void {
  if (nowSec - mismatchWindow.windowStart >= WINDOW_SEC) {
    mismatchWindow = { windowStart: nowSec, total: 0, mismatches: 0 };
  }
}

/** Record a verification result into the rolling window. */
export function recordVerification(valid: boolean): void {
  const nowSec = Math.floor(Date.now() / 1000);
  advanceWindowIfNeeded(nowSec);
  mismatchWindow.total += 1;
  if (!valid) mismatchWindow.mismatches += 1;
}

/** Compute current mismatch rate and breach status. */
export function getMismatchRate(): {
  windowSec: number;
  total: number;
  mismatches: number;
  ratePct: number;
  breach: boolean;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  advanceWindowIfNeeded(nowSec);
  const { total, mismatches } = mismatchWindow;
  const ratePct = total > 0 ? (mismatches / total) * 100 : 0;
  const breach = total >= 10 && ratePct > THRESHOLDS.hmacMismatchRatePctMax;
  return {
    windowSec: WINDOW_SEC,
    total,
    mismatches,
    ratePct: Math.round(ratePct * 100) / 100,
    breach,
  };
}

export interface CanaryResponse {
  valid: boolean;
  format: 'unified' | 'legacy' | 'unknown';
  skewMs: number;
  ageMs: number;
  thresholds: typeof THRESHOLDS;
  mismatchRate: ReturnType<typeof getMismatchRate>;
  breach: boolean;
}

export function parseTimestampFromHeader(header: string): number | null {
  for (const part of header.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    if (k === 't') {
      const ts = parseInt(v, 10);
      return isNaN(ts) ? null : ts;
    }
  }
  return null;
}

export function detectFormat(signature: string): CanaryResponse['format'] {
  if (signature.includes('t=') && signature.includes('v1=')) return 'unified';
  if (/^[0-9a-f]{64}$/i.test(signature)) return 'legacy';
  return 'unknown';
}
