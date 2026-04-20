/**
 * POST /api/admin/dunning/[licenseNonce]/restore
 *
 * Manually restore a suspended license (admin action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { createServerClient } from '@/lib/db/client';
import { restoreLicense } from '@/lib/billing/dunning-workflow';
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
      .single() as { data: { role: string } | null; error: Error | null };

    const isAdmin = userData?.role === 'admin' || (user as { user_metadata?: { role?: string } }).user_metadata?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
    }

    // Get request body
    const body = await req.json().catch(() => ({}));
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
    logger.error('[Admin Dunning API] Error restoring license', error as Error);
    return NextResponse.json(
      { error: 'Failed to restore license' },
      { status: 500 }
    );
  }
}
