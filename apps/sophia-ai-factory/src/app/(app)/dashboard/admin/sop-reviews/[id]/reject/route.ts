import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { revalidatePath } from 'next/cache';

export interface RejectResult {
  success: boolean;
  error?: string;
}

export async function rejectSopListing(listingId: string, reason: string): Promise<RejectResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
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
      .first<{ description?: string }>();

    if (!listing) {
      return { success: false, error: 'Listing not found or not pending review' };
    }

    // Update status to draft with rejection reason in description
    const updatedDescription = `${listing.description || ''}\n\n---\n\n**Admin Rejection Reason:** ${reason}`;

    await d1
      .prepare('UPDATE sop_listings SET status = ?, description = ?, updated_at = ? WHERE id = ?')
      .bind('draft', updatedDescription, Math.floor(Date.now() / 1000), listingId)
      .run();

    logger.info('[AdminSOPReview] Listing rejected', undefined, {
      listingId,
      rejectedBy: user.id,
      tier,
      reason,
    });

    revalidatePath('/dashboard/admin/sop-reviews');

    return { success: true };
  } catch (err) {
    logger.error('[AdminSOPReview] Reject error', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  let reason = 'Not approved by admin';
  try {
    const body = (await request.json()) as { reason?: string };
    if (body.reason && typeof body.reason === 'string') {
      reason = body.reason;
    }
  } catch {
    // default reason if body is not JSON or empty
  }

  const result = await rejectSopListing(id, reason);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}