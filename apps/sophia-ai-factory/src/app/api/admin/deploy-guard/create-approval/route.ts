/**
 * POST /api/admin/deploy-guard/create-approval
 * Internal endpoint called by deploy-with-sha.sh to create a new approval request.
 *
 * Allows either admin session or deploy automation token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrDeploy } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'
import { logger } from '@/seed/utils/logger-utility'

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrDeploy(request)
  if (auth instanceof Response) return auth

  try {
    const body = await request.json() as {
      commitSha: string
      branch: string
      operatorHost: string
      diffSummary: string
      filesChanged: number
      requiredAttestations?: number
    }

    // For automated deploys, operator identity comes from X-Deploy-Operator header
    // For web UI, use the logged-in admin's user ID
    const operatorUser = auth.isDeployToken
      ? (request.headers.get('X-Deploy-Operator') || 'deploy-script')
      : auth.userId

    const result = await approvalService.createApproval({
      commitSha: body.commitSha,
      branch: body.branch,
      operatorHost: body.operatorHost,
      operatorUser,
      diffSummary: body.diffSummary,
      filesChanged: body.filesChanged,
      requiredAttestations: body.requiredAttestations ?? 2
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    logger.error('Failed to create approval', error instanceof Error ? error : { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to create approval', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
