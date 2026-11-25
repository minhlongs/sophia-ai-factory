/**
 * Public `/llms.txt` index for AI Search & Agentic Commerce crawlers.
 *
 * @module app/llms.txt/route
 */

import { NextResponse } from 'next/server';
import { buildLlmsTxtIndex } from '@/tree/aeo/campaign-citation-builder';

const DEFAULT_CF_BASE_URL = 'https://sophia-ai-factory.agencyos-openclaw.workers.dev';

export async function GET(): Promise<NextResponse> {
  const baseUrl =
    process.env.APP_URL || process.env.WORKER_TECHNICAL_URL || DEFAULT_CF_BASE_URL;
  const content = buildLlmsTxtIndex(baseUrl, []);

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
