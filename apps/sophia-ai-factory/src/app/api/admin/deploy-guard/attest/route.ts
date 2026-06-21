/**
 * POST /api/admin/deploy-guard/attest
 * Record an operator's attestation signature.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrDeploy } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrDeploy(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()

    // Operator ID: from header if deploy token, else from admin session
    const operatorId = auth.isDeployToken
      ? (request.headers.get('X-Deploy-Operator') || 'deploy-script')
      : auth.userId

    const result = await approvalService.attest(
      body.approvalId,
      operatorId,
      body.signature,
      request.headers.get('user-agent') || 'unknown'
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to record attestation:', error)
    return NextResponse.json(
      { error: 'Failed to record attestation', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
