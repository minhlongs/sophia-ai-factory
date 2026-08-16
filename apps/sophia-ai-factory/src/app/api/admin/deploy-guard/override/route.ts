/**
 * POST /api/admin/deploy-guard/override
 * Request emergency override (bypass deploy guard).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrDeploy } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'
import { logger } from '@/seed/utils/logger-utility'

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrDeploy(request)
  if (auth instanceof Response) return auth

  try {
    const body = await request.json() as { commitSha: string; reason: string }

    // Operator ID: from header if deploy token, else from admin session
    const requestedBy = auth.isDeployToken
      ? (request.headers.get('X-Deploy-Operator') || 'deploy-script')
      : auth.userId

    const override = await approvalService.requestOverride({
      commitSha: body.commitSha,
      requestedBy,
      reason: body.reason
    })

    return NextResponse.json({ override }, { status: 201 })
  } catch (error) {
    logger.error('Failed to create override', error instanceof Error ? error : { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to create override', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
