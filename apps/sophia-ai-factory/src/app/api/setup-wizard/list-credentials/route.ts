/**
 * GET /api/setup-wizard/list-credentials
 *
 * Returns provider credential metadata for the authenticated user.
 * Never returns plaintext keys -- only display_hints and metadata.
 * Auth required.
 *
 * @module app/api/setup-wizard/list-credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { listUserProviders } from '@/tree/credentials/user-credentials-repo'
import type { CredentialSummary } from '@/tree/credentials/user-credentials-repo'

export interface ListCredentialsResponse {
  credentials: CredentialSummary[]
}

export async function GET(_request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ credentials: [] }, { status: 401 })
  }

  const credentials = await listUserProviders(user.id)
  return NextResponse.json<ListCredentialsResponse>({ credentials })
}
