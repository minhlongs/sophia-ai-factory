/**
 * Backup code generation, SHA-256 hashing, and consumption helpers for MFA TOTP.
 * @module seed/auth/mfa/backup-codes-helpers
 */

const BACKUP_CODE_COUNT = 8;

/**
 * Generate backup codes: BACKUP_CODE_COUNT unique codes in XXXX-XXXX format.
 * Returns plaintext codes — caller must hash before persisting.
 */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes: Set<string> = new Set();
  while (codes.size < count) {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    const part1 = buf.slice(0, 2).reduce((s, b) => s + b.toString(16).padStart(2, '0').toUpperCase(), '');
    crypto.getRandomValues(buf);
    const part2 = buf.slice(0, 2).reduce((s, b) => s + b.toString(16).padStart(2, '0').toUpperCase(), '');
    codes.add(`${part1}-${part2}`);
  }
  return Array.from(codes);
}

/**
 * Hash a backup code with SHA-256.
 * Used for storage — plaintext codes are never stored.
 */
export async function hashBackupCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash all backup codes and return JSON string for storage.
 */
export async function hashBackupCodesToJson(codes: string[]): Promise<string> {
  const hashed = await Promise.all(codes.map(hashBackupCode));
  return JSON.stringify(hashed);
}

/**
 * Verify a backup code against stored hashes.
 * Returns the index of the matched code, or -1 if not found.
 */
export async function verifyBackupCode(
  code: string,
  storedJson: string,
): Promise<number> {
  const hashed = await hashBackupCode(code);
  const stored: string[] = JSON.parse(storedJson);
  return stored.indexOf(hashed);
}

/**
 * Remove a used backup code from the stored JSON by index.
 * Returns updated JSON string.
 */
export function consumeBackupCode(storedJson: string, index: number): string {
  const stored: string[] = JSON.parse(storedJson);
  stored.splice(index, 1);
  return JSON.stringify(stored);
}
