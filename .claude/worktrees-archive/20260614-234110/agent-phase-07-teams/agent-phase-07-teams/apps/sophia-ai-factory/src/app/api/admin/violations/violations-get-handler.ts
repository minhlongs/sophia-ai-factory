/**
 * GET handler for Admin Violations API
 * @module api/admin/violations/violations-get-handler
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { requireAdmin } from '@/seed/auth/require-admin'
import { z } from 'zod'
import { violationsListSchema, type ViolationRow, type LicenseInfo, type UserInfo, type ViolationRecord } from './violations-schemas'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {

    const searchParams = req.nextUrl.searchParams
    const params = violationsListSchema.parse(Object.fromEntries(searchParams))
    const db = createServerClient()

    let query = db.from<ViolationRow>('violations').select('*', { count: 'exact' })
    if (params.type) query = query.eq('type', params.type)
    if (params.severity) query = query.eq('severity', params.severity)
    if (params.license_id) query = query.ilike('license_nonce', `%${params.license_id}%`)
    if (params.resolved !== undefined) query = query.eq('resolved', params.resolved === 'true')
    if (params.date_from) query = query.gte('created_at', new Date(params.date_from).toISOString())
    if (params.date_to) query = query.lte('created_at', new Date(params.date_to).toISOString())

    const from = (params.page - 1) * params.limit
    query = query.range(from, from + params.limit - 1).order('created_at', { ascending: false })

    const { data: violationsData, error: violationsError, count } = await query

    if (violationsError) {
      // Pass a plain object preserving both .message and .code — TS rejects
      // QueryError directly because it has no index signature; the earlier
      // `new Error(msg)` wrap satisfied the type-check but dropped .code,
      // losing the only structured discriminator for transient vs permanent
      // DB failures downstream.
      logger.error('[Violations] Error fetching violations', { message: violationsError.message, code: violationsError.code })
      return NextResponse.json({ error: 'Failed to fetch violations' }, { status: 500 })
    }

    const licenseNonces = violationsData?.map((v: ViolationRow) => v.license_nonce) || []
    let licenseInfo: LicenseInfo[] = []
    if (licenseNonces.length > 0) {
      const { data } = await db.from<LicenseInfo>('raas_api_keys').select('license_nonce, tier, status').in('license_nonce', licenseNonces)
      licenseInfo = data || []
    }

    const userIds = [...new Set(violationsData?.map((v: ViolationRow) => v.user_id) || [])]
    let userInfo: UserInfo[] = []
    if (userIds.length > 0) {
      const { data } = await db.from<UserInfo>('user_profiles').select('user_id, email').in('user_id', userIds)
      userInfo = data || []
    }

    const records: ViolationRecord[] = (violationsData || []).map((v: ViolationRow) => {
      const lic = licenseInfo.find((l: LicenseInfo) => l.license_nonce === v.license_nonce)
      const usr = userInfo.find((u: UserInfo) => u.user_id === v.user_id)
      return { id: v.id, type: v.type, severity: v.severity, userId: v.user_id, licenseNonce: v.license_nonce, tier: v.tier, endpoint: v.endpoint, ipAddress: v.ip_address, userAgent: v.user_agent, metadata: v.metadata, createdAt: v.created_at, resolved: v.resolved, resolvedAt: v.resolved_at, resolvedBy: v.resolved_by, userEmail: usr?.email, licenseTier: lic?.tier, licenseStatus: lic?.status }
    })

    logger.info('[Violations] Retrieved violations', { count: records.length, total: count, page: params.page, typeFilter: params.type, severityFilter: params.severity, resolvedFilter: params.resolved })
    return NextResponse.json({ data: records, pagination: { page: params.page, limit: params.limit, total: count || 0, totalPages: count ? Math.ceil(count / params.limit) : 0 } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[Violations] Invalid query parameters', { issues: error.issues })
      return NextResponse.json({ error: 'Invalid parameters', details: error.issues }, { status: 400 })
    }
    logger.error('[Violations] Error', toError(error))
    return NextResponse.json({ error: 'Failed to fetch violations' }, { status: 500 })
  }
}
