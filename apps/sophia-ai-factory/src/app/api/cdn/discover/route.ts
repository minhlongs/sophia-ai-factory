/**
 * Global Edge CDN Discovery Route
 *
 * Edge runtime endpoint providing sub-80ms p95 latency edge POP routing,
 * optimal variant resolution, and RFC 5861 Cache-Control / Cache-Tag headers.
 *
 * Runtime: Cloudflare Workers Edge
 */

export const runtime = 'edge';
export { GET } from './core';
