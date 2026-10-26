import { NextRequest, NextResponse } from 'next/server';
import { INDEXNOW_KEY, buildIndexNowSubmissionPayload } from '@/seed/aeo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get('format');
  if (format === 'json') {
    return NextResponse.json(buildIndexNowSubmissionPayload(), {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new NextResponse(INDEXNOW_KEY, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
