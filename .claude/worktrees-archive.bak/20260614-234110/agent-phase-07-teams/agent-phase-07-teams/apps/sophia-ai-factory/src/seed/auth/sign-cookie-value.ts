/**
 * Cookie signing scheme compatible with Better Auth / better-call.
 *
 * Better-call's `signCookieValue` (crypto.mjs) produces:
 *   encodeURIComponent(`${value}.${base64(HMAC-SHA256(value, secret))}`)
 *
 * `auth.api.getSession()` only accepts cookies signed this way — raw session
 * tokens are rejected. Mirror the scheme exactly so manually-issued sessions
 * (handover magic-link consume) get accepted by Better Auth's verifier.
 *
 * @module lib/auth/sign-cookie-value
 */

/** Sign a cookie value with HMAC-SHA256, percent-encoded, dot-separated. */
export async function signCookieValue(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return encodeURIComponent(`${value}.${sig}`);
}

/**
 * Hash an email address with SHA-256 for privacy-preserving audit logs.
 * Returns the first 16 hex chars (collision-resistant enough for ops queries).
 */
export async function hashEmail(email: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(email.toLowerCase().trim()));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 16);
}
