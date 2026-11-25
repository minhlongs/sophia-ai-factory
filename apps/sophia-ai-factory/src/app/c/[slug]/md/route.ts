/**
 * Public Markdown companion endpoint `/c/[slug]/md` for AI agents & LLM crawlers.
 *
 * @module app/c/[slug]/md/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildCampaignCitationMarkdown,
  type CampaignCitationRecord,
} from '@/tree/aeo/campaign-citation-builder';

const DEFAULT_CF_BASE_URL = 'https://sophia-ai-factory.agencyos-openclaw.workers.dev';
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,80}$/i;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  if (!SAFE_SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid citation slug' }, { status: 400 });
  }

  const baseUrl =
    process.env.APP_URL || process.env.WORKER_TECHNICAL_URL || DEFAULT_CF_BASE_URL;
  const record: CampaignCitationRecord = {
    slug,
    title: `Sophia Verified Review: ${slug}`,
    summary: `Structured product review and verified affiliate link for ${slug}.`,
    keyProof: 'Fact-checked comparison points with transparent affiliate disclosure.',
    verdict: 'Recommended for buyers evaluating practical workflow ROI.',
    ctaText: 'Open Verified Partner Offer',
    shortUrl: `${baseUrl.replace(/\/$/, '')}/api/r/${slug}`,
    disclosureTag: '#ad',
    durationSec: 180,
    updatedAtIso: new Date().toISOString(),
  };

  const md = buildCampaignCitationMarkdown(record, baseUrl);
  return new NextResponse(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
