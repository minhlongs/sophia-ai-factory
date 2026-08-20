/**
 * POST /api/sop-marketplace/review — Submit a review for an installed SOP.
 *
 * Body: { listingId: string; rating: number; reviewText?: string }
 * Auth: Required (session)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { createSopReview } from '@/seed/db/marketplace-ops';

export const dynamic = 'force-dynamic';

const ReviewBody = z.object({
  installId: z.string().min(1).max(100),
  listingId: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = ReviewBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const db = await getD1();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { installId, listingId, rating, review: reviewText } = parsed.data;

    // Verify the install belongs to this user
    // (createSopReview does not check ownership — we check here)
    const install = await db
      .prepare('SELECT user_id FROM sop_installs WHERE id = ?1 AND listing_id = ?2')
      .bind(installId, listingId)
      .first<{ user_id: string }>();

    if (!install) {
      return NextResponse.json({ error: 'Install not found' }, { status: 404 });
    }
    if (install.user_id !== user.id) {
      return NextResponse.json({ error: 'Not your install' }, { status: 403 });
    }

    await createSopReview(db, {
      install_id: installId,
      user_id: user.id,
      rating,
      review_text: reviewText ?? null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
