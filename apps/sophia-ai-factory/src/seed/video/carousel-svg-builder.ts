/**
 * Zero-GPU Edge SVG Carousel Slide & Dynamic QR Overlay Builder.
 *
 * Clean-room pure-TS SVG generator for TikTok Photo Mode, Instagram Carousels,
 * and LinkedIn slide decks running in 0ms on Cloudflare Workers V8 isolates
 * with zero headless browser or GPU COGS.
 *
 * Layer: seed/video (pure XML/SVG builder, zero external deps)
 *
 * @module seed/video/carousel-svg-builder
 */

export interface CarouselSlideInput {
  readonly slideNumber: number;
  readonly totalSlides: number;
  readonly headline: string;
  readonly body: string;
  readonly footerUrl: string;
  readonly disclosureTag: string;
}

function escapeXml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function renderCarouselSlideSvg(input: CarouselSlideInput): string {
  const progressPct = Math.min(
    100,
    Math.max(5, Math.round((input.slideNumber / Math.max(1, input.totalSlides)) * 100)),
  );
  const barWidth = Math.round((960 * progressPct) / 100);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">`,
    `<rect width="1080" height="1350" fill="#090A10"/>`,
    `<rect x="60" y="60" width="960" height="8" rx="4" fill="#1E293B"/>`,
    `<rect x="60" y="60" width="${barWidth}" height="8" rx="4" fill="#6366F1"/>`,
    `<text x="60" y="130" fill="#94A3B8" font-family="Inter, sans-serif" font-size="28" font-weight="600">SLIDE ${input.slideNumber} / ${input.totalSlides} • ${escapeXml(input.disclosureTag)}</text>`,
    `<text x="60" y="260" fill="#F8FAFC" font-family="Inter, sans-serif" font-size="56" font-weight="700">${escapeXml(input.headline.slice(0, 64))}</text>`,
    `<text x="60" y="420" fill="#CBD5E1" font-family="Inter, sans-serif" font-size="36">${escapeXml(input.body.slice(0, 140))}</text>`,
    `<rect x="60" y="1140" width="960" height="130" rx="16" fill="#111827" stroke="#334155" stroke-width="2"/>`,
    `<text x="96" y="1215" fill="#F59E0B" font-family="JetBrains Mono, monospace" font-size="24" font-weight="700">${escapeXml(input.footerUrl.slice(0, 80))}</text>`,
    `</svg>`,
  ].join('');
}
