/**
 * Public Landing Pages [slug] API — read-only, no auth.
 *
 * GET /api/public/landing-pages/[slug] -> get published landing page by slug
 * Returns 404 for unpublished or missing pages.
 */

import { NextResponse } from 'next/server';
import { getBySlug } from '@/seed/db/repositories/landing-pages-repo';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { slug } = await params;
    const page = await getBySlug(slug);

    if (!page) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!page.isPublished) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (err) {
    logger.error("[PublicLandingPagesAPI] GET slug failed", {
      error: getErrorMessage(err),
    });
    return NextResponse.json({ error: "Failed to get landing page" }, { status: 500 });
  }
}
