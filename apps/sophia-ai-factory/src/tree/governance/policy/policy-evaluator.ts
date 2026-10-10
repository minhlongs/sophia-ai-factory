/**
 * Agent Governance YAML (AGY) Policy Evaluator & SHA-256 Digest Utilities
 *
 * @module tree/governance/policy/policy-evaluator
 */

import type { PolicyEvaluationRequest } from '@/seed/types/agent-governance';

/**
 * Matches a single permission pattern against a requested action.
 * Supports:
 * - Exact case-insensitive match (e.g., 'video:render' matches 'video:render')
 * - Global wildcard '*' (matches any action)
 * - Prefix wildcard 'prefix:*' (matches 'prefix:render' or 'prefix')
 *
 * Prevents delimiter bypass (e.g., 'video:*' does not match 'video_extra:read').
 */
export function matchPermission(pattern: string, action: string): boolean {
  const normPattern = pattern.trim().toLowerCase();
  const normAction = action.trim().toLowerCase();

  if (normPattern === '*' || normPattern === normAction) {
    return true;
  }

  if (normPattern.endsWith(':*')) {
    const prefix = normPattern.slice(0, -2);
    return normAction.startsWith(prefix + ':') || normAction === prefix;
  }

  return false;
}

/**
 * Computes deterministic SHA-256 hex digest using Web Crypto API.
 * Works seamlessly in both Cloudflare Workers edge runtime and modern Node.js.
 */
export async function computeEvaluationSha256(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates the canonical digest string for policy evaluation results.
 */
export function buildEvaluationDigestPayload(
  request: PolicyEvaluationRequest,
  allowed: boolean,
  reason: string,
): string {
  return [
    request.agencyId,
    request.agentId,
    request.action.trim().toLowerCase(),
    request.requestedAutonomy,
    request.requestedComputeUnits,
    allowed ? '1' : '0',
    reason,
  ].join(':');
}

/**
 * Asynchronously generates SHA-256 evaluation digest using Web Crypto API.
 */
export async function generatePolicyEvaluationDigest(
  request: PolicyEvaluationRequest,
  allowed: boolean,
  reason: string,
): Promise<string> {
  const payload = buildEvaluationDigestPayload(request, allowed, reason);
  return computeEvaluationSha256(payload);
}

/**
 * Synchronous pure SHA-256 implementation for deterministic digests in synchronous flows.
 * Uses standard FIPS 180-4 SHA-256 algorithm with zero external imports.
 */
export function computeSha256Sync(input: string): string {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const utf8 = new TextEncoder().encode(input);
  const bitLength = utf8.length * 8;

  const totalLength = ((utf8.length + 9 + 63) >> 6) << 6;
  const buffer = new Uint8Array(totalLength);
  buffer.set(utf8);
  buffer[utf8.length] = 0x80;

  const view = new DataView(buffer.buffer);
  view.setUint32(totalLength - 4, bitLength >>> 0, false);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000), false);

  const w = new Uint32Array(64);

  for (let i = 0; i < totalLength; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^
                 ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^
                 (w[t - 15] >>> 3);
      const s1 = ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^
                 ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^
                 (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[t] + w[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

/**
 * Synchronous digest generator.
 */
export function generatePolicyEvaluationDigestSync(
  request: PolicyEvaluationRequest,
  allowed: boolean,
  reason: string,
): string {
  const payload = buildEvaluationDigestPayload(request, allowed, reason);
  return computeSha256Sync(payload);
}
