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
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { requireAdmin } from '@/seed/auth/require-admin';
import { z } from 'zod';
import { suspendLicense, restoreLicense } from '@/land/billing/dunning-workflow';
import {
  dunningListSchema,
  dunningActionSchema,
  fetchDunningRows,
  enrichDunningRows,
  getLicenseUserId,
} from './dunning-status-query';

/**
 * GET /api/admin/dunning/status
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {

    const searchParams = req.nextUrl.searchParams;
    const params = dunningListSchema.parse(Object.fromEntries(searchParams));

    const db = createServerClient();
    const { rows, count, error: dunningError } = await fetchDunningRows(params, db);

    if (dunningError) {
      logger.error('[Dunning Status] Error fetching dunning statuses', toError(dunningError));
      return NextResponse.json(
        { error: 'Failed to fetch dunning statuses' },
        { status: 500 }
      );
    }

    const records = await enrichDunningRows(rows, db);
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

    logger.error('[Dunning Status] Error', toError(error));
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
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {

    const body = await req.json();
    const parsed = dunningActionSchema.parse(body);

    const db = createServerClient();
    const userId = await getLicenseUserId(parsed.licenseNonce, db);

    if (!userId) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      );
    }

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

    logger.error('[Dunning Status] Error performing action', toError(error));
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
