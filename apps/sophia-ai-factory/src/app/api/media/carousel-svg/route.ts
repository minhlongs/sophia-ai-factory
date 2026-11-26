/**
 * GET /api/media/carousel-svg — Zero-GPU Edge SVG Carousel Slide Renderer.
 *
 * @module app/api/media/carousel-svg/route
 */

import { NextRequest } from 'next/server';
import { renderCarouselSlideSvg } from '@/seed/video/carousel-svg-builder';

export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const slide = Math.max(1, Number.parseInt(sp.get('slide') ?? '1', 10) || 1);
  const total = Math.max(slide, Number.parseInt(sp.get('total') ?? '5', 10) || 5);
  const headline = (sp.get('headline') ?? 'Sophia Affiliate Carousel').slice(0, 80);
  const body = (sp.get('body') ?? 'Zero-GPU edge carousel slide ready for TikTok Photo Mode & IG.').slice(0, 160);
  const footerUrl = (sp.get('url') ?? 'sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/demo').slice(0, 80);
  const disclosureTag = (sp.get('disclosure') ?? '#ad').slice(0, 24);

  const svg = renderCarouselSlideSvg({
    slideNumber: slide,
    totalSlides: total,
    headline,
    body,
    footerUrl,
    disclosureTag,
  });

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
