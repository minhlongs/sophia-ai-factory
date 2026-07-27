// ── Agency API Key Generator ─────────────────────────────────────────────────
// Generates and hashes API keys for white-label agency authentication.
// Keys are never stored as plaintext — always SHA-256 hashed.

/** 32 bytes of cryptographically random data → base64url (43 chars, no padding) */
export function generateAgencyApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

/** SHA-256 hash → base64url (for DB storage, never plaintext) */
export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(new Uint8Array(buf)).toString('base64url');
}

/** Verify a key against stored hash (constant-time compare) */
export async function verifyApiKey(key: string, storedHash: string): Promise<boolean> {
  const keyHash = await hashApiKey(key);
  // Constant-time comparison to prevent timing attacks
  if (keyHash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < keyHash.length; i++) {
    diff |= keyHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

/** API key pair returned on creation */
export interface AgencyApiKey {
  key: string;   // plaintext — shown to user once
  hash: string;  // SHA-256 hash for DB storage
}

/** Generate a new key pair (hash returns Promise — await before DB insert) */
export async function createAgencyApiKey(): Promise<AgencyApiKey> {
  const key = generateAgencyApiKey();
  const hash = await hashApiKey(key);
  return { key, hash };
}
