import crypto from 'crypto';

const IV_LENGTH = 16; // For AES, this is always 16

function getEncryptionKey(): Buffer {
  const keyHex = process.env.API_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('Encryption key not configured');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts text using AES-256-GCM
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Return format: iv:authTag:encryptedContent
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts text using AES-256-GCM
 */
export function decrypt(text: string): string {
  const key = getEncryptionKey();

  const parts = text.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = Buffer.from(parts[2], 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

/**
 * Mask an API key for display (e.g., "sk-...482s")
 */
export function maskApiKey(key: string, visibleChars = 4): string {
  if (!key || key.length <= visibleChars * 2) return '********';
  return `${key.slice(0, 3)}...${key.slice(-visibleChars)}`;
}
