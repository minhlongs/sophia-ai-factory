import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getLlmsTxt } from '../llms.txt/route';
import { GET as getLlmsFullTxt } from '../llms-full.txt/route';
import { GET as getAgentJson } from '../.well-known/agent.json/route';
import { GET as getAeoMarkdown } from '../api/aeo/markdown/route';
import type { AgentDiscoveryManifest } from '@/seed/aeo';
import {
  isAeoMarkdownNegotiatedRequest,
  handleAeoMarkdownNegotiation,
} from '@/middleware/aeo-negotiation';

describe('AEO / GEO Edge Endpoints & Content Negotiation', () => {
  it('GET /llms.txt returns text/plain with bilingual corpus index', async () => {
    const res = await getLlmsTxt();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('# Sophia AI Factory');
    expect(text).toContain('llms-full.txt');
  });

  it('GET /llms-full.txt returns full corpus with all 4 tiers and 51 niches', async () => {
    const res = await getLlmsFullTxt();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/markdown');
    const text = await res.text();
    expect(text).toContain('BASIC');
    expect(text).toContain('PREMIUM');
    expect(text).toContain('ENTERPRISE');
    expect(text).toContain('MASTER');
    expect(text).toContain('real-estate');
    expect(text).toContain('crypto');
  });

  it('GET /.well-known/agent.json returns valid Agent Discovery Protocol manifest', async () => {
    const res = await getAgentJson();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const json = (await res.json()) as AgentDiscoveryManifest;
    expect(json.schemaVersion).toBe('2027.1');
    expect(json.dualReadProtocol.acceptHeader).toBe('text/markdown');
    expect(json.supportedNicheCount).toBe(51);
  });

  it('GET /api/aeo/markdown serves YAML-frontmatter Markdown for public and niche routes', async () => {
    const reqPricing = new NextRequest('https://sophia.agencyos.network/api/aeo/markdown?path=/vi/pricing&locale=vi');
    const resPricing = await getAeoMarkdown(reqPricing);
    expect(resPricing.status).toBe(200);
    expect(resPricing.headers.get('Vary')).toContain('Accept');
    const mdPricing = await resPricing.text();
    expect(mdPricing).toContain('surface: "pricing"');
    expect(mdPricing).toContain('USDT (NOWPayments)');

    const reqNiche = new NextRequest('https://sophia.agencyos.network/api/aeo/markdown?path=/en/ai-video/crypto&locale=en');
    const resNiche = await getAeoMarkdown(reqNiche);
    const mdNiche = await resNiche.text();
    expect(mdNiche).toContain('surface: "ai-video-niche"');
    expect(mdNiche).toContain('Crypto');
  });

  it('Middleware handleAeoMarkdownNegotiation negotiates Accept: text/markdown on public routes only', () => {
    const publicMdReq = new NextRequest('https://sophia.agencyos.network/vi/pricing', {
      headers: { Accept: 'text/markdown, text/html;q=0.8' },
    });
    expect(isAeoMarkdownNegotiatedRequest(publicMdReq)).toBe(true);
    const publicRes = handleAeoMarkdownNegotiation(publicMdReq, new Headers(), 'test-nonce', false);
    expect(publicRes).not.toBeNull();
    expect(publicRes?.headers.get('Vary')).toContain('Accept');

    const dashboardReq = new NextRequest('https://sophia.agencyos.network/vi/dashboard/settings', {
      headers: { Accept: 'text/markdown' },
    });
    expect(isAeoMarkdownNegotiatedRequest(dashboardReq)).toBe(false);
    expect(handleAeoMarkdownNegotiation(dashboardReq, new Headers(), 'test-nonce', false)).toBeNull();
  });

  it('GET /api/aeo/markdown returns 404 for non-negotiable paths like /dashboard or /setup', async () => {
    const reqDash = new NextRequest('https://sophia.agencyos.network/api/aeo/markdown?path=/vi/dashboard/settings&locale=vi');
    const resDash = await getAeoMarkdown(reqDash);
    expect(resDash.status).toBe(404);
    expect(resDash.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    const reqSetup = new NextRequest('https://sophia.agencyos.network/api/aeo/markdown?path=/setup.md');
    const resSetup = await getAeoMarkdown(reqSetup);
    expect(resSetup.status).toBe(404);
  });
});

