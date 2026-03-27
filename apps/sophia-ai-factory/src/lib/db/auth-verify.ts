/**
 * JWT verification — extracted to avoid circular imports with client.ts
 * Lightweight module used by middleware for fast token validation.
 */

// Lazy getter — returns null when JWT_SECRET is not set (zero-config safe)
function getJwtSecret(): string | null {
  return process.env.JWT_SECRET ?? null;
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): unknown {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(padded));
}

export async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;

    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;

    const expected = await hmacSign(`${header}.${body}`, secret);
    if (expected !== signature) return null;

    const payload = base64UrlDecode(body) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) return null;

    return payload;
  } catch {
    return null;
  }
}
