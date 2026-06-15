/**
 * URL Product Extractor — Workers-safe HTML metadata extractor.
 *
 * Fetches a URL and extracts product info using regex on raw HTML.
 * No external deps required (no cheerio/htmlparser2 — CF Workers safe).
 */

export interface ProductInfo {
  title: string;
  description: string;
  imageUrl: string;
  price: string;
  canonical: string;
}

/**
 * Extract a meta tag content value from raw HTML string.
 */
function extractMeta(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["\']${escaped}["\'][^>]+content=["\']([^"\']*)["\']`,
    'i',
  );
  const m = html.match(re);
  if (m) return m[1];

  // Try reversed attribute order
  const re2 = new RegExp(
    `<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']${escaped}["\']`,
    'i',
  );
  const m2 = html.match(re2);
  return m2 ? m2[1] : '';
}

function extractTitle(html: string): string {
  const ogTitle = extractMeta(html, 'og:title');
  if (ogTitle) return ogTitle;
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractPrice(html: string): string {
  const jsonLdMatch = html.match(/<script[^>]+type=["\']application\/ld\+json["\'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]) as Record<string, unknown>;
      const offer = (data['offers'] as Record<string, string> | undefined);
      if (offer?.price) return `${offer.price} ${offer.priceCurrency ?? ''}`.trim();
    } catch { /* ignore parse errors */ }
  }
  return (
    extractMeta(html, 'product:price:amount') ||
    extractMeta(html, 'og:price:amount') ||
    extractMeta(html, 'twitter:data1')
  );
}

/**
 * Extract product info from a URL.
 * Caller must validate HTTPS-only before calling.
 */
export async function extractProductInfo(url: string): Promise<ProductInfo> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SophiaBot/1.0; +https://sophia.agencyos.network)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching product URL`);
  }

  // Read only first 100KB to avoid large pages
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const MAX_BYTES = 100_000;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.length;
      if (totalBytes >= MAX_BYTES) break;
    }
    reader.cancel().catch(() => {});
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  const html = new TextDecoder().decode(merged);

  return {
    title: extractTitle(html),
    description: extractMeta(html, 'og:description') || extractMeta(html, 'description'),
    imageUrl: extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image'),
    price: extractPrice(html),
    canonical: extractMeta(html, 'og:url') || url,
  };
}
