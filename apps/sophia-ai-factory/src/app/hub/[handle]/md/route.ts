/**
 * Public Markdown companion endpoint `/hub/[handle]/md` for AI agents & crawlers.
 *
 * @module app/hub/[handle]/md/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildDefaultStorefrontHub,
  buildStorefrontHubMarkdown,
  SAFE_HUB_HANDLE_RE,
} from '@/tree/aeo/storefront-hub-builder';

const DEFAULT_CF_BASE_URL = 'https://sophia-ai-factory.agencyos-openclaw.workers.dev';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ handle: string }> },
): Promise<NextResponse> {
  const { handle } = await context.params;
  if (!SAFE_HUB_HANDLE_RE.test(handle)) {
    return NextResponse.json({ error: 'Invalid hub handle' }, { status: 400 });
  }

  const baseUrl =
    process.env.APP_URL || process.env.WORKER_TECHNICAL_URL || DEFAULT_CF_BASE_URL;
  const profile = buildDefaultStorefrontHub(handle, baseUrl);
  const md = buildStorefrontHubMarkdown(profile, baseUrl);

  return new NextResponse(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
