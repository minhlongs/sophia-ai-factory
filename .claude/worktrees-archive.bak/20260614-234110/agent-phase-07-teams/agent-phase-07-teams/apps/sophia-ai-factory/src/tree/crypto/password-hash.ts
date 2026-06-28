/**
 * Password hashing utilities using Web Crypto API (PBKDF2).
 * Compatible with Cloudflare Workers runtime.
 * Format: pbkdf2:{saltHex}:{hashHex}
 */

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256,
  );
  const hash = new Uint8Array(derived);
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hash).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, saltHex, storedHashHex] = stored.split(':');
  if (!saltHex || !storedHashHex) return false;

  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256,
  );
  const hashHex = Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHashHex;
}
