import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getOpenApiJson } from '../api/openapi.json/route';
import { GET as getIndexNow } from '../api/aeo/indexnow/route';
import { GET as getAeoMarkdown } from '../api/aeo/markdown/route';
import {
  buildLlmDeepLinkUrls,
  buildEeatTelemetryProof,
  getAllBilingualUrls,
  type AeoSecondarySurface,
} from '@/seed/aeo';
import { buildJsonLdGraph, serializeJsonLdSafe } from '@/tree/aeo';
import { resolveAeoPayloadFromPath } from '@/tree/aeo/resolve-aeo-route';
import { isPublicApiRoute } from '@/forest/middleware/guard/public-routes';

const ALL_SECONDARY_SURFACES: readonly AeoSecondarySurface[] = [
  'features',
  'solutions',
  'products',
  'marketplace',
  'sop-marketplace',
  'benchmarks',
  'operations',
  'partner',
  'blog',
  'contact',
  'terms',
  'privacy',
  'affiliate-disclosure',
  'affiliate-terms',
];

describe('2027 AEO / GEO 4 Pillars & 14 Secondary Surfaces', () => {
  it('resolves all 14 secondary public surfaces in VI and EN with E-E-A-T telemetry proof', async () => {
    for (const surface of ALL_SECONDARY_SURFACES) {
      const payloadVi = resolveAeoPayloadFromPath(`/vi/${surface}`, 'vi');
      expect(payloadVi).not.toBeNull();
      expect(payloadVi?.surface).toBe(surface);
      expect(payloadVi?.telemetryProof?.activeNichesCount).toBe(51);
      expect(payloadVi?.telemetryProof?.byokZeroMarkup).toBe(true);

      const req = new NextRequest(`https://sophia.agencyos.network/api/aeo/markdown?path=/en/${surface}&locale=en`);
      const res = await getAeoMarkdown(req);
      expect(res.status).toBe(200);
      const md = await res.text();
      expect(md).toContain(`surface: "${surface}"`);
    }
  });

  it('Pillar 1: buildLlmDeepLinkUrls generates ChatGPT, Claude, and Perplexity URLs with secret redaction', () => {
    const fakeKey = ['sk-or-v1-', 'abcdef1234567890abcdef1234567890'].join('');
    const links = buildLlmDeepLinkUrls({
      canonicalUrl: 'https://sophia.agencyos.network/vi/pricing',
      isVi: true,
      contextSnippet: `Tài liệu với mã bí mật ${fakeKey}`,
    });
    expect(links.chatgpt).toContain('https://chatgpt.com/?q=');
    expect(links.claude).toContain('https://claude.ai/new?q=');
    expect(links.perplexity).toContain('https://www.perplexity.ai/search?q=');
    expect(decodeURIComponent(links.chatgpt)).toContain('[REDACTED_API_KEY]');
    expect(decodeURIComponent(links.chatgpt)).not.toContain(fakeKey);
  });

  it('Pillar 2: GET /api/openapi.json returns OpenAPI 3.1.0 schema and is registered in public-routes', async () => {
    expect(isPublicApiRoute('/api/openapi.json')).toBe(true);
    const res = await getOpenApiJson();
    expect(res.status).toBe(200);
    const spec = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.paths['/llms.txt']).toBeDefined();
    expect(spec.paths['/.well-known/agent.json']).toBeDefined();
    expect(spec.paths['/api/aeo/markdown']).toBeDefined();
    expect(spec.paths['/api/aeo/indexnow']).toBeDefined();
  });

  it('Pillar 3: JSON-LD @graph includes E-E-A-T telemetry proof and escapes < safely', () => {
    const proof = buildEeatTelemetryProof();
    expect(proof.activeNichesCount).toBe(51);
    const payload = resolveAeoPayloadFromPath('/vi/pricing', 'vi');
    expect(payload).not.toBeNull();
    const graph = buildJsonLdGraph(payload!);
    const serialized = serializeJsonLdSafe(graph);
    expect(serialized).toContain('deployedSha');
    expect(serialized).toContain('byokZeroMarkup');
    expect(serialized).not.toContain('</script>');
  });

  it('Pillar 4: GET /api/aeo/indexnow returns key verification or full 120+ bilingual URL manifest', async () => {
    expect(isPublicApiRoute('/api/aeo/indexnow')).toBe(true);
    const urls = getAllBilingualUrls();
    expect(urls.length).toBeGreaterThanOrEqual(120);

    const reqJson = new NextRequest('https://sophia.agencyos.network/api/aeo/indexnow?format=json');
    const resJson = await getIndexNow(reqJson);
    expect(resJson.status).toBe(200);
    const data = (await resJson.json()) as { urlList: string[] };
    expect(data.urlList.length).toBeGreaterThanOrEqual(120);
    expect(data.urlList.length).toBe(urls.length);

    const reqTxt = new NextRequest('https://sophia.agencyos.network/api/aeo/indexnow?format=key');
    const resTxt = await getIndexNow(reqTxt);
    expect(resTxt.status).toBe(200);
    expect(resTxt.headers.get('Content-Type')).toContain('text/plain');
  });
});
