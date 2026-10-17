/**
 * User Provider Credentials Types, Errors & Read-Only Listing
 *
 * @module tree/credentials/user-credentials-helpers
 */

import { getD1 } from '@/seed/db/client'

// M11: error thrown when stored credential cannot be decrypted (key rotated)
export class ByokKeyRotatedError extends Error {
  constructor(public readonly provider: string) {
    super(`BYOK_KEY_ROTATED: credential for '${provider}' cannot be decrypted — the encryption key was rotated while this credential was stored. Re-enter your key in Settings > Integrations.`)
    this.name = 'ByokKeyRotatedError'
  }
}

export type ProviderType = 'heygen' | 'heygen_webhook_secret' | 'resend' | 'nowpayments' | 'local_llm' | 'kling' | 'assemblyai' | 'openai' | 'openrouter' | 'replicate'

export interface CredentialSummary {
  provider: ProviderType
  display_hint: string | null
  status: 'active' | 'disabled' | 'revoked'
  last_used_at: number | null
}

export interface CredentialRow {
  encrypted_value: string
  key_version: number | null
  status: string
}

export interface SummaryRow {
  provider: string
  display_hint: string | null
  status: string
  last_used_at: number | null
}

export function makeDisplayHint(plaintext: string): string {
  if (plaintext.length <= 4) return '...' + plaintext
  return '...' + plaintext.slice(-4)
}

/**
 * List credential metadata for a user (no plaintext exposed).
 */
export async function listUserProviders(userId: string): Promise<CredentialSummary[]> {
  if (!userId) return []
  const db = await getD1()
  if (!db) throw new Error('D1 database binding not available')
  const d1 = db

  try {
    const { results } = await d1
      .prepare(
        `SELECT provider, display_hint, status, last_used_at
         FROM user_provider_credentials
         WHERE user_id = ?1 ORDER BY provider ASC`,
      )
      .bind(userId)
      .all<SummaryRow>()

    return (results ?? []).map((r) => ({
      provider: r.provider as ProviderType,
      display_hint: r.display_hint,
      status: r.status as CredentialSummary['status'],
      last_used_at: r.last_used_at,
    }))
  } catch {
    return []
  }
}
