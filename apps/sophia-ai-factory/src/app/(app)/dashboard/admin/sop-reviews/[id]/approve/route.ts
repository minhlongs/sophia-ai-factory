import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { revalidatePath } from 'next/cache';
import {
  CREATOR_MARKETPLACE_V2_ENABLED,
  MARKETPLACE_TEMPORARILY_UNAVAILABLE,
  marketplaceTemporarilyUnavailableError,
} from '@/land/sop-marketplace/availability';

export interface ApproveResult {
  success: boolean;
  error?: string;
  code?: typeof MARKETPLACE_TEMPORARILY_UNAVAILABLE;
}

export async function approveSopListing(listingId: string): Promise<ApproveResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    if (!CREATOR_MARKETPLACE_V2_ENABLED) {
      const unavailable = marketplaceTemporarilyUnavailableError();
      return { success: false, code: unavailable.code, error: unavailable.message };
    }

    // Check admin tier
    const tier = await resolveUserTier(user.id);
    if (tier !== 'MASTER' && tier !== 'ENTERPRISE') {
      return { success: false, error: 'Admin access required' };
    }

    const d1 = await getD1();
    if (!d1) {
      return { success: false, error: 'Database not available' };
    }

    // Verify listing exists and is pending review
    const listing = await d1
      .prepare('SELECT * FROM sop_listings WHERE id = ? AND status = ?')
      .bind(listingId, 'pending_review')
      .first();

    if (!listing) {
      return { success: false, error: 'Listing not found or not pending review' };
    }

    // Update status to published
    await d1
      .prepare('UPDATE sop_listings SET status = ?, updated_at = ? WHERE id = ?')
      .bind('published', Math.floor(Date.now() / 1000), listingId)
      .run();

    logger.info('[AdminSOPReview] Listing approved', undefined, {
      listingId,
      approvedBy: user.id,
      tier,
    });

    revalidatePath('/dashboard/admin/sop-reviews');

    return { success: true };
  } catch (err) {
    logger.error('[AdminSOPReview] Approve error', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const result = await approveSopListing(id);
  const status = result.success ? 200 : result.code === MARKETPLACE_TEMPORARILY_UNAVAILABLE ? 503 : 400;
  return NextResponse.json(result, { status });
}
