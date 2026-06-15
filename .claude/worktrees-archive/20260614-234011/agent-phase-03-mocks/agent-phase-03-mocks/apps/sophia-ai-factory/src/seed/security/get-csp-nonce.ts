/**
 * Server-side helper to read the per-request CSP nonce set by middleware.
 * Call this from Server Components / layouts that render inline scripts.
 *
 * Returns undefined in environments where headers() is unavailable
 * (e.g. static generation, Edge previews without request context).
 */
import { headers } from 'next/headers'

export const CSP_NONCE_HEADER = 'x-csp-nonce'

export async function getCspNonce(): Promise<string | undefined> {
  try {
    const headerStore = await headers()
    return headerStore.get(CSP_NONCE_HEADER) ?? undefined
  } catch {
    // headers() throws outside of request context (static generation)
    return undefined
  }
}
