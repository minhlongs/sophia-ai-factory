/**
 * POST /api/admin/dunning/[licenseNonce]/restore
 *
 * Manually restore a suspended license (admin action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { createServerClient } from '@/seed/db/client';
import { restoreLicense } from '@/lib/billing/dunning-workflow';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

interface RestoreLicenseRequest {
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
    const body = (await req.json().catch(() => ({}))) as RestoreLicenseRequest;
    const reason = body.reason || 'Manual restoration by admin';

    // Get user ID from license
    const { data: license } = await db
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', params.licenseNonce)
      .single() as { data: { created_by: string } | null; error: Error | null };

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    // Restore license
    const result = await restoreLicense(params.licenseNonce, license.created_by, reason);

    logger.info('[Admin Dunning API] License manually restored', {
      licenseNonce: params.licenseNonce.slice(0, 8) + '...',
      reason,
      newState: result.state,
    });

    return NextResponse.json({
      success: true,
      message: 'License restored successfully',
      state: result.state,
      allowed: result.allowed,
    });
  } catch (error) {
    logger.error('[Admin Dunning API] Error restoring license', toError(error));
    return NextResponse.json(
      { error: 'Failed to restore license' },
      { status: 500 }
    );
  }
}
