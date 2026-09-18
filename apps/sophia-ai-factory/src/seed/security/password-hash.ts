import { timingSafeEqual } from '@/seed/security/crypto-utils';

/**
 * Password hashing utilities using Web Crypto API (PBKDF2).
 * Compatible with Cloudflare Workers runtime.
 * Format: pbkdf2:{saltHex}:{hashHex}
 *
 * Layer: seed/security (foundational cryptographic primitives)
 */

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256,
  );
  const hash = new Uint8Array(derived);
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashHex = Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (
    typeof password !== 'string' ||
    typeof stored !== 'string' ||
    password.length === 0 ||
    stored.length === 0
  ) {
    return false;
  }

  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') {
    return false;
  }

  const [, saltHex, storedHashHex] = parts;
  if (!saltHex || !storedHashHex) {
    return false;
  }

  // Validate hex format and even length
  if (saltHex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(saltHex)) {
    return false;
  }
  if (storedHashHex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(storedHashHex)) {
    return false;
  }

  const saltMatches = saltHex.match(/.{2}/g);
  if (!saltMatches) {
    return false;
  }

  try {
    const salt = new Uint8Array(saltMatches.map((b) => parseInt(b, 16)));
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key,
      256,
    );
    const hashHex = Array.from(new Uint8Array(derived))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return timingSafeEqual(hashHex, storedHashHex);
  } catch {
    return false;
  }
}

