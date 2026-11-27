/**
 * Round 37 — Tamper-Evident SubID & Attribution Watermark Encoder.
 *
 * Encodes compact, URL-safe affiliate SubIDs (`<campaign>.<creator>.<variant>.<sig>`)
 * protected by a deterministic FNV-1a 32-bit checksum so S2S postbacks from
 * Impact, PartnerStack, Bybit, or OKX can reject forged or truncated click IDs.
 *
 * @module seed/affiliate/subid-watermark-encoder
 */

export interface SubIdPayload {
  readonly campaignId: string;
  readonly creatorId: string;
  readonly variantId: string;
}

export interface SubIdVerificationResult {
  readonly valid: boolean;
  readonly payload: SubIdPayload | null;
  readonly reason: string;
}

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]{1,24}$/;

function fnv1a32Base36(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(6, '0').slice(0, 6);
}

export function encodeTamperEvidentSubId(payload: SubIdPayload, salt: string): string {
  const c = payload.campaignId.trim();
  const u = payload.creatorId.trim();
  const v = payload.variantId.trim();
  if (!SAFE_SEGMENT.test(c) || !SAFE_SEGMENT.test(u) || !SAFE_SEGMENT.test(v)) {
    throw new Error('SubID segments must match /^[a-zA-Z0-9_-]{1,24}$/');
  }
  const body = `${c}.${u}.${v}`;
  const sig = fnv1a32Base36(`${salt}:${body}`);
  return `${body}.${sig}`;
}

export function verifyTamperEvidentSubId(rawSubId: string, salt: string): SubIdVerificationResult {
  const parts = rawSubId.trim().split('.');
  if (parts.length !== 4) {
    return { valid: false, payload: null, reason: 'Malformed SubID segment count' };
  }
  const [campaignId, creatorId, variantId, sig] = parts;
  if (!SAFE_SEGMENT.test(campaignId) || !SAFE_SEGMENT.test(creatorId) || !SAFE_SEGMENT.test(variantId)) {
    return { valid: false, payload: null, reason: 'Invalid characters in SubID segment' };
  }
  const expectedSig = fnv1a32Base36(`${salt}:${campaignId}.${creatorId}.${variantId}`);
  if (sig !== expectedSig) {
    return { valid: false, payload: null, reason: 'Checksum mismatch (tampered or wrong salt)' };
  }
  return {
    valid: true,
    payload: { campaignId, creatorId, variantId },
    reason: 'Verified tamper-evident SubID',
  };
}
