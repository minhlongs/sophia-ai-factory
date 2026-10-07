/**
 * Credential Vault Service
 *
 * Handles transient decryption and provisioning of customer-owned keys.
 * Strict interface to prevent keys from leaking into persistent stores.
 *
 * Layer: tree/credentials/vault
 * @module tree/credentials/vault
 */

import { ProviderConfig } from '@/seed/config/providers/registry';

export interface CredentialVault {
  getDecryptedKey(tenantId: string, providerId: string): Promise<string | null>;
}

// Logic: Fetches raw encrypted key from D1, decrypts using worker secret, returns active key
export const getSafeKey = async (tenantId: string, provider: ProviderConfig): Promise<string> => {
  // Mock: In practice, this hits D1 secret store
  const storedKey = process.env[provider.id.toUpperCase() + '_KEY'] || '';
  if (!storedKey) {
     throw new Error(`Credential missing for ${provider.name}. Please configure in Setup Wizard.`);
  }
  return storedKey;
};
