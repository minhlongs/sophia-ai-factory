/**
 * GET /api/admin/violations
 * List violations with filtering and pagination
 *
 * POST /api/admin/violations
 * Mark violation as resolved or escalate
 *
 * Admin-only endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/better-auth-session';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { checkAdminAuth } from '../middleware';
import { z } from 'zod';

/**
 * Query params validation schema
 */
const violationsListSchema = z.object({
  type: z.enum([
    'quota_exceeded',
    'invalid_license',
    'expired_license',
    'revoked_license',
    'rate_limit_exceeded',
    'unauthorized_access',
    'cross_tenant_access',
  ]).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  license_id: z.string().max(100).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  date_from: z.string().max(20).optional(),
  date_to: z.string().max(20).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Action validation schema for POST
 */
const violationActionSchema = z.object({
  violationId: z.string().uuid(),
  action: z.enum(['resolve', 'escalate']),
  reason: z.string().min(1).max(500),
});

/**
 * Violation record with user info
 */
interface ViolationRecord {
  id: string;
  type: string;
  severity: string;
  userId: string;
  licenseNonce: string;
  tier: string;
  endpoint: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  // User info join
  userEmail?: string;
  licenseTier?: string;
  licenseStatus?: string;
}

/**
 * Database row type for violations table
 */
interface ViolationRow {
  id: string;
  type: string;
  severity: string;
  user_id: string;
  license_nonce: string;
  tier: string;
  endpoint: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
}

/**
 * License info from raas_api_keys table
 */
interface LicenseInfo {
  license_nonce: string;
  tier: string;
  status: string;
}

/**
 * User info from user_profiles table
 */
interface UserInfo {
  user_id: string;
  email: string;
}

/**
 * GET /api/admin/violations
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin auth
    const authError = checkAdminAuth(req);
    if (authError) return authError;

    const searchParams = req.nextUrl.searchParams;
    const params = violationsListSchema.parse(Object.fromEntries(searchParams));

    const db = createServerClient();

    // Build query
    let query = db
      .from('violations')
      .select('*', { count: 'exact' });

    // Apply filters
    if (params.type) {
      query = query.eq('type', params.type);
    }

    if (params.severity) {
      query = query.eq('severity', params.severity);
    }

    if (params.license_id) {
      query = query.ilike('license_nonce', `%${params.license_id}%`);
    }

    if (params.resolved !== undefined) {
      query = query.eq('resolved', params.resolved === 'true');
    }

    if (params.date_from) {
      query = query.gte('created_at', new Date(params.date_from).toISOString());
    }

    if (params.date_to) {
      query = query.lte('created_at', new Date(params.date_to).toISOString());
    }

    // Apply pagination
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data: violationsData, error: violationsError, count } = await query;

    if (violationsError) {
      logger.error('[Violations] Error fetching violations', violationsError);
      return NextResponse.json(
        { error: 'Failed to fetch violations' },
        { status: 500 }
      );
    }

    // Get license info for each record
    const licenseNonces = violationsData?.map((v: ViolationRow) => v.license_nonce) || [];
    let licenseInfo: LicenseInfo[] = [];

    if (licenseNonces.length > 0) {
      const { data: licenseData } = await db
        .from('raas_api_keys')
        .select('license_nonce, tier, status')
        .in('license_nonce', licenseNonces);
      licenseInfo = licenseData || [];
    }

    // Get user emails for each record
    const userIds = [...new Set(violationsData?.map((v: ViolationRow) => v.user_id) || [])];
    let userInfo: UserInfo[] = [];

    if (userIds.length > 0) {
      const { data: userData } = await db
        .from('user_profiles')
        .select('user_id, email')
        .in('user_id', userIds);
      userInfo = userData || [];
    }

    // Combine data
    const records: ViolationRecord[] = (violationsData || []).map((v: ViolationRow) => {
      const lic = licenseInfo.find((l: LicenseInfo) => l.license_nonce === v.license_nonce);
      const usr = userInfo.find((u: UserInfo) => u.user_id === v.user_id);

      return {
        id: v.id,
        type: v.type,
        severity: v.severity,
        userId: v.user_id,
        licenseNonce: v.license_nonce,
        tier: v.tier,
        endpoint: v.endpoint,
        ipAddress: v.ip_address,
        userAgent: v.user_agent,
        metadata: v.metadata,
        createdAt: v.created_at,
        resolved: v.resolved,
        resolvedAt: v.resolved_at,
        resolvedBy: v.resolved_by,
        userEmail: usr?.email,
        licenseTier: lic?.tier,
        licenseStatus: lic?.status,
      };
    });

    const totalPages = count ? Math.ceil(count / params.limit) : 0;

    logger.info('[Violations] Retrieved violations', {
      count: records.length,
      total: count,
      page: params.page,
      typeFilter: params.type,
      severityFilter: params.severity,
      resolvedFilter: params.resolved,
    });

    return NextResponse.json({
      data: records,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count || 0,
        totalPages,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[Violations] Invalid query parameters', { issues: error.issues });
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('[Violations] Error', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch violations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/violations
 * Mark violation as resolved or escalate
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin auth
    const authError = checkAdminAuth(req);
    if (authError) return authError;

    // Parse request body
    const body = await req.json();
    const parsed = violationActionSchema.parse(body);

    // Get current user ID (admin user)
    const currentUser = await getCurrentUser();
    const currentUserId = currentUser?.id;

    if (parsed.action === 'resolve') {
      // Mark violation as resolved
      const { error } = await db
        .from('violations')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: currentUserId,
        })
        .eq('id', parsed.violationId);

      if (error) {
        logger.error('[Violations] Error resolving violation', error);
        return NextResponse.json(
          { error: 'Failed to resolve violation' },
          { status: 500 }
        );
      }

      logger.info('[Violations] Violation resolved', {
        violationId: parsed.violationId,
        reason: parsed.reason,
        resolvedBy: currentUserId,
      });

      return NextResponse.json({
        success: true,
        action: 'resolve',
        violationId: parsed.violationId,
        resolvedAt: new Date().toISOString(),
      });
    } else if (parsed.action === 'escalate') {
      // Escalate violation - update metadata with escalation info
      const { error } = await db
        .from('violations')
        .update({
          metadata: { escalated: true, escalatedAt: new Date().toISOString(), reason: parsed.reason },
        })
        .eq('id', parsed.violationId);

      logger.warn('[Violations] Violation escalated', {
        violationId: parsed.violationId,
        reason: parsed.reason,
      });

      return NextResponse.json({
        success: true,
        action: 'escalate',
        violationId: parsed.violationId,
        escalatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[Violations] Invalid request body', { issues: error.issues });
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('[Violations] Error performing action', toError(error));
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
