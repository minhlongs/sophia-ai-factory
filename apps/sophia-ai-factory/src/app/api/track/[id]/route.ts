/**
 * GET /api/r/[id] — Edge tracking redirect
 *
 * Looks up tracking link, records click (cookieless S2S), returns 302 redirect.
 * Returns 410 Gone for inactive links, 404 for unknown links.
 *
 * Edge runtime: runs on Cloudflare Workers.
 * Subdomain: track.sophia.agencyos.network → CNAME → workers.dev
 * (See src/lib/tracking/tracking-README.md for DNS setup)
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordClick } from '@/lib/tracking/edge-link';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!id || typeof id !== 'string' || id.length !== 8) {
    return NextResponse.json({ error: 'Invalid link ID' }, { status: 400 });
  }

  try {
    const destinationUrl = await recordClick(id, request);
    return NextResponse.redirect(destinationUrl, { status: 302 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message === 'Link inactive') {
      return NextResponse.json(
        { error: 'This link is no longer active' },
        { status: 410 },
      );
    }

    if (message === 'Link not found') {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // Unexpected error — fail safe with 404 to avoid leaking internals
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }
}
