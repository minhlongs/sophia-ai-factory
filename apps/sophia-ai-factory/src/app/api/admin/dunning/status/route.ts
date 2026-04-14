/**
 * GET /api/admin/dunning/status
 * List dunning statuses with filtering and pagination
 *
 * POST /api/admin/dunning/status
 * Manual suspend/restore license action
 *
 * Admin-only endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { checkAdminAuth } from '../../middleware';
import { z } from 'zod';
import type { DunningState } from '@/lib/billing/dunning-workflow';
import { suspendLicense, restoreLicense } from '@/lib/billing/dunning-workflow';

/**
 * Query params validation schema
 */
const dunningListSchema = z.object({
  status: z.enum(['current', 'past_due', 'delinquent', 'suspended']).optional(),
  license_id: z.string().max(100).optional(),
  date_from: z.string().max(20).optional(),
  date_to: z.string().max(20).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Action validation schema for POST
 */
const dunningActionSchema = z.object({
  licenseNonce: z.string().min(1),
  action: z.enum(['suspend', 'restore']),
  reason: z.string().min(1).max(500),
});

/**
 * Dunning status record with license info
 */
interface DunningStatusRecord {
  id: string;
  licenseNonce: string;
  userId: string;
  state: DunningState;
  gracePeriodDays: number;
  maxRetryAttempts: number;
  failedPaymentCount: number;
  nextRetryAt: string | null;
  polarCustomerId: string | null;
  stripeCustomerId: string | null;
  stateChangedAt: string;
  createdAt: string;
  updatedAt: string;
  // License info join
  licenseTier?: string;
  licenseStatus?: string;
  userEmail?: string;
}

/**
 * GET /api/admin/dunning/status
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin auth
    const authError = checkAdminAuth(req);
    if (authError) return authError;

    const searchParams = req.nextUrl.searchParams;
    const params = dunningListSchema.parse(Object.fromEntries(searchParams));

    const db = createServerClient();

    // Build query
    let query = db
      .from('dunning_settings')
      .select('*', { count: 'exact' });

    // Apply filters
    if (params.status) {
      query = query.eq('dunning_state', params.status);
    }

    if (params.license_id) {
      query = query.ilike('license_nonce', `%${params.license_id}%`);
    }

    if (params.date_from) {
      query = query.gte('updated_at', new Date(params.date_from).toISOString());
    }

    if (params.date_to) {
      query = query.lte('updated_at', new Date(params.date_to).toISOString());
    }

    // Apply pagination
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;
    query = query.range(from, to).order('updated_at', { ascending: false });

    const { data: dunningData, error: dunningError, count } = await query;

    if (dunningError) {
      logger.error('[Dunning Status] Error fetching dunning statuses', dunningError);
      return NextResponse.json(
        { error: 'Failed to fetch dunning statuses' },
        { status: 500 }
      );
    }

    // Get license info for each record
    interface LicenseInfo {
      license_nonce: string;
      tier: string;
      status: string;
    }

    interface DunningRow {
      id: string;
      license_nonce: string;
      user_id: string;
      dunning_state: string;
      grace_period_days: number;
      max_retry_attempts: number;
      polar_customer_id: string | null;
      stripe_customer_id: string | null;
      dunning_state_changed_at: string;
      created_at: string;
      updated_at: string;
    }

    interface UserInfo {
      user_id: string;
      email: string;
    }

    const licenseNonces = dunningData?.map((d: DunningRow) => d.license_nonce) || [];
    let licenseInfo: LicenseInfo[] = [];

    if (licenseNonces.length > 0) {
      const { data: licenseData } = await db
        .from('raas_api_keys')
        .select('license_nonce, tier, status')
        .in('license_nonce', licenseNonces);
      licenseInfo = licenseData || [];
    }

    // Get user emails for each record
    const userIds = dunningData?.map((d: DunningRow) => d.user_id) || [];
    let userInfo: UserInfo[] = [];

    if (userIds.length > 0) {
      const { data: userData } = await db
        .from('user_profiles')
        .select('user_id, email')
        .in('user_id', userIds);
      userInfo = userData || [];
    }

    // Combine data
    const records: DunningStatusRecord[] = (dunningData || []).map((d: DunningRow) => {
      const lic = licenseInfo.find((l: LicenseInfo) => l.license_nonce === d.license_nonce);
      const usr = userInfo.find((u: UserInfo) => u.user_id === d.user_id);

      return {
        id: d.id,
        licenseNonce: d.license_nonce,
        userId: d.user_id,
        state: d.dunning_state as DunningState,
        gracePeriodDays: d.grace_period_days,
        maxRetryAttempts: d.max_retry_attempts,
        failedPaymentCount: 0, // Would need separate query for exact count
        nextRetryAt: null, // Would need separate query
        polarCustomerId: d.polar_customer_id,
        stripeCustomerId: d.stripe_customer_id,
        stateChangedAt: d.dunning_state_changed_at,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        licenseTier: lic?.tier,
        licenseStatus: lic?.status,
        userEmail: usr?.email,
      };
    });

    const totalPages = count ? Math.ceil(count / params.limit) : 0;

    logger.info('[Dunning Status] Retrieved statuses', {
      count: records.length,
      total: count,
      page: params.page,
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
      logger.warn('[Dunning Status] Invalid query parameters', { issues: error.issues });
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('[Dunning Status] Error', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch dunning statuses' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/dunning/status
 * Manual suspend/restore license
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin auth
    const authError = checkAdminAuth(req);
    if (authError) return authError;

    // Parse request body
    const body = await req.json();
    const parsed = dunningActionSchema.parse(body);

    const db = createServerClient();

    // Get user ID for license
    const { data: licenseData } = await db
      .from('raas_api_keys')
      .select('user_id')
      .eq('license_nonce', parsed.licenseNonce)
      .single();

    if (!licenseData) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      );
    }

    const userId = licenseData.user_id;

    let result;

    if (parsed.action === 'suspend') {
      result = await suspendLicense(parsed.licenseNonce, userId, parsed.reason);
      logger.warn('[Dunning Status] License manually suspended', {
        licenseNonce: parsed.licenseNonce.slice(0, 8),
        reason: parsed.reason,
      });
    } else {
      result = await restoreLicense(parsed.licenseNonce, userId, parsed.reason);
      logger.info('[Dunning Status] License manually restored', {
        licenseNonce: parsed.licenseNonce.slice(0, 8),
        reason: parsed.reason,
      });
    }

    return NextResponse.json({
      success: true,
      action: parsed.action,
      licenseNonce: parsed.licenseNonce.slice(0, 8) + '...',
      newState: result.state,
      allowed: result.allowed,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[Dunning Status] Invalid request body', { issues: error.issues });
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('[Dunning Status] Error performing action', error as Error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
