/**
 * GET /api/admin/billing/overage-events
 *
 * List overage events with filtering and pagination
 * - Filter by billable status
 * - Filter by license_id
 * - Filter by date range
 * - Include license information join
 *
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { requireAdmin } from '@/seed/auth/require-admin';
import { z } from 'zod';
import type { OverageEventRow } from '@/seed/types/billing-contracts';

/**
 * Query params validation schema
 */
const overageEventsSchema = z.object({
  billable: z.enum(['true', 'false']).optional(),
  license_id: z.string().max(100).optional(),
  date_from: z.string().max(20).optional(),
  date_to: z.string().max(20).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Overage event record with license info
 */
interface OverageEventRecord extends OverageEventRow {
  licenseTier?: string;
  licenseStatus?: string;
  userEmail?: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {

    const searchParams = req.nextUrl.searchParams;
    const params = overageEventsSchema.parse(Object.fromEntries(searchParams));

    const db = createServerClient();

    // Build query
    let query = db
      .from('overage_events')
      .select('*', { count: 'exact' });

    // Apply filters
    if (params.billable !== undefined) {
      query = query.eq('billable', params.billable === 'true');
    }

    if (params.license_id) {
      query = query.ilike('license_nonce', `%${params.license_id}%`);
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

    const { data: rawEventsData, error: eventsError, count } = await query;
    const eventsData = rawEventsData as unknown as OverageEventRow[] | null;

    if (eventsError) {
      logger.error('[Overage Events] Error fetching overage events', toError(eventsError));
      return NextResponse.json(
        { error: 'Failed to fetch overage events' },
        { status: 500 }
      );
    }

    // Get license info for each record
    interface LicenseInfo {
      license_nonce: string;
      tier: string;
      status: string;
      user_id: string;
    }

    const licenseNonces = eventsData?.map((d: OverageEventRow) => d.license_nonce) || [];
    let licenseInfo: LicenseInfo[] = [];

    if (licenseNonces.length > 0) {
      const { data: licenseData } = await db
        .from('raas_api_keys')
        .select('license_nonce, tier, status, user_id')
        .in('license_nonce', licenseNonces);
      licenseInfo = (licenseData || []) as unknown as LicenseInfo[];
    }

    // Get user emails for each record
    interface UserInfo {
      user_id: string;
      email: string;
    }

    const userIds = [...new Set(eventsData?.map((d: OverageEventRow) => d.user_id) || [])];
    let userInfo: UserInfo[] = [];

    if (userIds.length > 0) {
      const { data: userData } = await db
        .from('user_profiles')
        .select('user_id, email')
        .in('user_id', userIds);
      userInfo = (userData || []) as unknown as UserInfo[];
    }

    // Combine data
    const records: OverageEventRecord[] = (eventsData || []).map((e: OverageEventRow) => {
      const lic = licenseInfo.find((l: LicenseInfo) => l.license_nonce === e.license_nonce);
      const usr = userInfo.find((u: UserInfo) => u.user_id === e.user_id);

      return {
        ...e,
        licenseTier: lic?.tier,
        licenseStatus: lic?.status,
        userEmail: usr?.email,
      };
    });

    const totalPages = count ? Math.ceil(count / params.limit) : 0;

    logger.info('[Overage Events] Retrieved events', {
      count: records.length,
      total: count,
      page: params.page,
      billableFilter: params.billable,
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
      logger.warn('[Overage Events] Invalid query parameters', { issues: error.issues });
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('[Overage Events] Error', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch overage events' },
      { status: 500 }
    );
  }
}
