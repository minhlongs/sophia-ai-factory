/**
 * GET /api/debug-symbols/[commit]/[...path]
 *
 * Self-hosted symbol server for source maps.
 * Fetches source map files from R2 bucket `SYMBOLS_BUCKET` and returns them.
 *
 * URL pattern: /api/debug-symbols/{commit}/{filepath}
 * Example: /api/debug-symbols/a1b2c3d4/app/page.js.map
 */

import { NextRequest, NextResponse } from 'next/server';

interface Env {
  SYMBOLS_BUCKET?: {
    get: (key: string) => Promise<{ body: ArrayBuffer } | null>;
  };
}

export const dynamic = 'force-dynamic'; // Always fetch from R2 at runtime

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ commit: string; path: string[] }> }
): Promise<Response> {
  const { commit, path } = await params;
  const env = globalThis as unknown as Env;
  const bucket = env.SYMBOLS_BUCKET;

  if (!bucket) {
    return NextResponse.json(
      { ok: false, error: 'Symbol server not configured' },
      { status: 500 }
    );
  }

  // Construct R2 key: {commit}/{path.join('/')}
  const r2Key = `${commit}/${path.join('/')}`;

  try {
    const result = await bucket.get(r2Key);
    if (!result || !result.body) {
      return NextResponse.json(
        { ok: false, error: 'Symbol not found', key: r2Key },
        { status: 404 }
      );
    }

    // Convert ArrayBuffer to Uint8Array for response
    const buffer = Buffer.from(result.body);
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400', // 1 day cache
        'X-Symbol-Key': r2Key,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch symbol', key: r2Key, reason: message },
      { status: 500 }
    );
  }
}
