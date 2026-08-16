/**
 * POST /api/admin/deploy-guard/attest
 * Record an operator's attestation signature.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrDeploy } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'
import { logger } from '@/seed/utils/logger-utility'

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrDeploy(request)
  if (auth instanceof Response) return auth

  try {
    const body = await request.json() as { approvalId: string; signature: string }

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
    logger.error('Failed to record attestation', error instanceof Error ? error : { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to record attestation', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
