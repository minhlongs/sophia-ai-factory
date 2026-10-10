/**
 * BYOK Crypto Module
 *
 * Layer: tree/byok/crypto
 */

import { encryptApiKey } from './envelope-encryption';
import { packedToText } from './types';

export * from './types';
export * from './byok-crypto-service';
export * from './envelope-encryption';

export function encryptApiKeyText(
  plain: string,
  userId?: string,
  keyVersion?: number,
): Promise<string> {
  return encryptApiKey(plain, userId, keyVersion).then(packedToText);
}
