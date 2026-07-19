import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isSafeUrl } from '@/seed/utils/is-safe-url';

// Use Edge Runtime for low latency

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // SSRF protection: only allow safe external HTTPS URLs
  if (!isSafeUrl(targetUrl)) {
    return NextResponse.json(
      { valid: false, error: 'Only external HTTPS URLs are allowed' },
      { status: 400 }
    );
  }

  try {
    // Perform a HEAD request to check availability without downloading body
    const response = await fetch(targetUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Sophia-Link-Validator/1.0',
      },
      redirect: 'manual', // Don't follow redirects to prevent SSRF via redirect
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    return NextResponse.json({
      valid: response.ok || response.status === 301 || response.status === 302,
      status: response.status,
      url: targetUrl,
    });
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 200 }, // Return 200 with valid: false to not break client
    );
  }
}
