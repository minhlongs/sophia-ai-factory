/**
 * Cryptographically Verified Affiliate Media Kit Attestation (WebCrypto JWS).
 *
 * Clean-room primitive (inspired by MIT panva/jose):
 * produces a compact HS256 JWS attestation proving bot-filtered click volume
 * and conversion rate WITHOUT leaking raw revenue — enabling creators to
 * negotiate 50-60% VIP commission tiers with Crypto exchanges and SaaS brands.
 *
 * Layer: seed/aeo (pure WebCrypto JWS signer/verifier)
 *
 * @module seed/aeo/verified-media-kit-attestation
 */

export interface MediaKitAttestationClaims {
  readonly workspaceSlug: string;
  readonly periodDays: number;
  readonly verifiedHumanClicks: number;
  readonly conversionRatePct: number;
  readonly botTrafficFilteredPct: number;
  readonly issuedAtIso: string;
}

function base64UrlEncode(input: Uint8Array): string {
  let binary = '';
  for (const b of input) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSha256(signingInput: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return base64UrlEncode(new Uint8Array(sig));
}

export async function signVerifiedMediaKitJws(
  claims: MediaKitAttestationClaims,
  signingSecret: string,
): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${header}.${payload}`;
  const signature = await hmacSha256(signingInput, signingSecret);
  return `${signingInput}.${signature}`;
}

export async function verifyMediaKitJws(
  token: string,
  signingSecret: string,
): Promise<{ readonly valid: boolean; readonly claims: MediaKitAttestationClaims | null }> {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, claims: null };
  const [header, payload, signature] = parts;
  const expectedSig = await hmacSha256(`${header}.${payload}`, signingSecret);
  if (signature !== expectedSig) return { valid: false, claims: null };
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    return { valid: true, claims: JSON.parse(json) as MediaKitAttestationClaims };
  } catch {
    return { valid: false, claims: null };
  }
}
