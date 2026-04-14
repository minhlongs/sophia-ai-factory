/**
 * POST /api/admin/dunning/[licenseNonce]/suspend
 *
 * Manually suspend a license (admin action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { createServerClient } from '@/lib/db/client';
import { suspendLicense } from '@/lib/billing/dunning-workflow';
import { logger } from '@/lib/utils/logger-utility';

export async function POST(
  req: NextRequest,
  { params }: { params: { licenseNonce: string } }
) {
  try {
    // Check admin auth
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const db = createServerClient();
    const { data: userData } = await db
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single() as any;

    const isAdmin = userData?.role === 'admin' || (user as any).user_metadata?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
    }

    // Get request body
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || 'Manual suspension by admin';

    // Get user ID from license
    const { data: license } = await db
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', params.licenseNonce)
      .single() as any;

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
    logger.error('[Admin Dunning API] Error suspending license', error as Error);
    return NextResponse.json(
      { error: 'Failed to suspend license' },
      { status: 500 }
    );
  }
}
