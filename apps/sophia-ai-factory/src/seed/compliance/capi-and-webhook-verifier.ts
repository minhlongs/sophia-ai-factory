/**
 * Server-Side CAPI WebCrypto SHA-256 PII Hasher & Standard Webhooks HMAC Verifier.
 *
 * Clean-room primitives (Apache-2.0 patterns from managed-components/tiktok and
 * standard-webhooks) running natively on Cloudflare Workers V8 isolates:
 * - Normalizes & SHA-256 hashes email / E.164 phone / external_id for Meta & TikTok CAPI.
 * - Verifies `whsec_` HMAC-SHA256 signatures over raw webhook bodies for zero-loss DLQ replay.
 *
 * Layer: seed/compliance (pure WebCrypto, zero external deps)
 *
 * @module seed/compliance/capi-and-webhook-verifier
 */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export async function sha256NormalizedPii(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

export async function signStandardWebhookPayload(args: {
  readonly webhookId: string;
  readonly timestampSec: number;
  readonly rawBody: string;
  readonly secret: string;
}): Promise<string> {
  const cleanSecret = args.secret.startsWith('whsec_') ? args.secret.slice(6) : args.secret;
  const keyBytes = new TextEncoder().encode(cleanSecret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signedContent = `${args.webhookId}.${args.timestampSec}.${args.rawBody}`;
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  return `v1,${toBase64(sigBuffer)}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

export async function verifyStandardWebhookSignature(args: {
  readonly webhookId: string;
  readonly timestampSec: number;
  readonly rawBody: string;
  readonly secret: string;
  readonly signatureHeader: string;
  readonly toleranceSec?: number;
  readonly nowSec?: number;
}): Promise<boolean> {
  const tolerance = args.toleranceSec ?? 300;
  const nowSec = args.nowSec ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(args.timestampSec) || Math.abs(nowSec - args.timestampSec) > tolerance) {
    return false;
  }
  const expected = await signStandardWebhookPayload(args);
  const providedCandidates = args.signatureHeader.trim().split(/\s+/);
  let matched = false;
  for (const candidate of providedCandidates) {
    if (constantTimeEqual(candidate, expected)) {
      matched = true;
    }
  }
  return matched;
}
