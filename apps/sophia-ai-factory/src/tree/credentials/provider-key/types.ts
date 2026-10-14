/**
 * Provider Key Resolution Types
 *
 * Layer: tree/credentials/provider-key
 */

export interface ProviderKeyResult {
  key: string
  source: 'user' | 'platform'
}

export interface GetKeyOptions {
  userId?: string
  fallbackToPlatform?: boolean
}
