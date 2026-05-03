/**
 * POST /api/admin/dunning/[licenseNonce]/suspend
 *
 * Manually suspend a license (admin action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { createServerClient } from '@/seed/db/client';
import { suspendLicense } from '@/lib/billing/dunning-workflow';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

interface SuspendLicenseRequest {
  reason?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { licenseNonce: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {

    const db = createServerClient();

    // Get request body
    const body = (await req.json().catch(() => ({}))) as SuspendLicenseRequest;
    const reason = body.reason || 'Manual suspension by admin';

    // Get user ID from license
    const { data: license } = await db
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', params.licenseNonce)
      .single() as { data: { created_by: string } | null; error: Error | null };

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    // Suspend license
    const result = await suspendLicense(params.licenseNonce, license.created_by, reason);

    logger.warn('[Admin Dunning API] License manually suspended', {
      licenseNonce: params.licenseNonce.slice(0, 8) + '...',
      reason,
      newState: result.state,
    });

    return NextResponse.json({
      success: true,
      message: 'License suspended successfully',
      state: result.state,
      allowed: result.allowed,
      blockReason: result.blockReason,
    });
  } catch (error) {
    logger.error('[Admin Dunning API] Error suspending license', toError(error));
    return NextResponse.json(
      { error: 'Failed to suspend license' },
      { status: 500 }
    );
  }
}
