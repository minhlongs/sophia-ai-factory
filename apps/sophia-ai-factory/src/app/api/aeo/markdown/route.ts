/**
 * Dual-Read Markdown projection endpoint (/api/aeo/markdown).
 * Serves clean, verified Markdown for any public surface when negotiated via
 * Accept: text/markdown or .md suffix rewrites.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isNonNegotiableAeoPath,
  resolveAeoPayloadFromPath,
  serializePageToMarkdown,
} from '@/tree/aeo';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const rawPath = searchParams.get('path') ?? searchParams.get('slug') ?? '/';
  const rawLocale = searchParams.get('locale');

  if (isNonNegotiableAeoPath(rawPath)) {
    return new NextResponse('Not Found: Non-public route does not expose public AEO Markdown.', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const payload = resolveAeoPayloadFromPath(rawPath, rawLocale);
  const markdown = serializePageToMarkdown(payload);

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept, Accept-Language',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'all',
      'X-AEO-Surface': payload.surface,
      'X-AEO-Locale': payload.locale,
    },
  });
}
