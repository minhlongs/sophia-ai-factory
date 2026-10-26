import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { TIER_CONFIGS } from '@/seed/config/tiers/tier-configs';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { NICHE_SLUGS } from '@/seed/config/niche-list';
import {
  buildAgentDiscoveryManifest,
  buildCorePagePayload,
  buildNicheHubPayload,
  buildSingleNichePayload,
  getAllVerifiedTiersSummary,
  getVerifiedTierSummary,
  redactSecretsFromRecord,
  redactSecretsFromText,
} from '@/seed/aeo';
import {
  buildJsonLdGraph,
  buildLlmsFullCorpusText,
  buildLlmsIndexText,
  resolveAeoPayloadFromPath,
  serializePageToMarkdown,
} from '@/tree/aeo';
import {
  handleAeoMarkdownNegotiation,
  isAeoMarkdownNegotiatedRequest,
} from '@/middleware/aeo-negotiation';

describe('Wave 1: AEO/GEO Single Source of Ground Truth & Dual-Read Engine', () => {
  it('derives verified tier pricing and MCU strictly from TIER_CONFIGS and UNIFIED_TIERS', () => {
    const summary = getAllVerifiedTiersSummary();
    expect(summary).toHaveLength(4);
    expect(summary[0]?.priceUsd).toBe(TIER_CONFIGS.BASIC.price);
    expect(summary[0]?.monthlyMcu).toBe(UNIFIED_TIERS.BASIC.mcuMonthly);
    expect(summary[3]?.priceUsd).toBe(TIER_CONFIGS.MASTER.price);
    expect(summary[3]?.monthlyMcu).toBe(UNIFIED_TIERS.MASTER.mcuMonthly);

    const basicSummary = getVerifiedTierSummary('BASIC');
    expect(basicSummary.priceDisplay).toBe(TIER_CONFIGS.BASIC.priceDisplay);
  });

  it('produces Agent Discovery Manifest (.well-known/agent.json) covering all 51 niches and 10 affiliate networks', () => {
    const manifest = buildAgentDiscoveryManifest();
    expect(manifest.schemaVersion).toBe('2027.1');
    expect(manifest.supportedNicheCount).toBe(NICHE_SLUGS.length);
    expect(manifest.affiliateNetworks).toHaveLength(10);
    expect(manifest.affiliateNetworks).toContain('OKX');
    expect(manifest.byokProviders).toEqual(expect.arrayContaining(['fal.ai', 'Replicate']));
    expect(manifest.dualReadProtocol.llmsIndexUrl).toContain('/llms.txt');
    expect(manifest.dualReadProtocol.llmsFullUrl).toContain('/llms-full.txt');
  });

  it('builds bilingual core and niche payloads and serializes to YAML-frontmatter Markdown', () => {
    const pricingVi = buildCorePagePayload('pricing', 'vi');
    const md = serializePageToMarkdown(pricingVi);
    expect(md).toContain('---');
    expect(md).toContain('surface: "pricing"');
    expect(md).toContain(TIER_CONFIGS.BASIC.priceDisplay);
    expect(md).toContain('Answer-First Summary');

    const hubEn = buildNicheHubPayload('en');
    expect(hubEn.comparisonRows.length).toBeGreaterThanOrEqual(2);

    const singleNiche = buildSingleNichePayload('real-estate', 'vi');
    expect(singleNiche).not.toBeNull();
    expect(singleNiche.nicheSlug).toBe('real-estate');
  });

  it('builds Schema.org JSON-LD @graph with Organization, SoftwareApplication, WebPage, FAQPage, and HowTo', () => {
    const homeEn = buildCorePagePayload('home', 'en');
    const graphDoc = buildJsonLdGraph(homeEn);
    expect(graphDoc['@context']).toBe('https://schema.org');
    const types = graphDoc['@graph'].map((node) => node['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('SoftwareApplication');
    expect(types).toContain('WebPage');
    expect(types).toContain('FAQPage');
    expect(types).toContain('HowTo');
  });

  it('generates /llms.txt and /llms-full.txt corpora with all 51 niche slugs', () => {
    const indexTxt = buildLlmsIndexText();
    const fullTxt = buildLlmsFullCorpusText();
    expect(indexTxt).toContain('# Sophia AI Factory');
    expect(indexTxt).toContain('51 industry niches');
    expect(fullTxt).toContain('real-estate');
    expect(fullTxt).toContain('financial-advisor');
    expect(fullTxt).toContain('All 51 Supported AI Video Industry Niches');
  });

  it('resolves public paths and .md extensions to their canonical Dual-Read payload', () => {
    const resolvedPricing = resolveAeoPayloadFromPath('/en/pricing.md');
    expect(resolvedPricing.surface).toBe('pricing');
    expect(resolvedPricing.locale).toBe('en');

    const resolvedNiche = resolveAeoPayloadFromPath('/vi/ai-video/crypto.md');
    expect(resolvedNiche.surface).toBe('ai-video-niche');
    expect(resolvedNiche.nicheSlug).toBe('crypto');
  });

  it('redacts API keys, JWTs, emails, and sensitive fields from LLM context exports', () => {
    const dirty = 'Key sk-proj-1234567890abcdefghijklmnop and user ceo@company.vn';
    const clean = redactSecretsFromText(dirty);
    expect(clean).not.toContain('sk-proj-1234567890abcdefghijklmnop');
    expect(clean).not.toContain('ceo@company.vn');
    expect(clean).toContain('[REDACTED_API_KEY]');
    expect(clean).toContain('[REDACTED_EMAIL]');

    const record = redactSecretsFromRecord({
      openrouterApiKey: 'secret-value',
      safeMetric: '124 videos',
    });
    expect(record.openrouterApiKey).toBe('[REDACTED_BY_POLICY]');
    expect(record.safeMetric).toBe('124 videos');
  });

  it('negotiates Accept: text/markdown on public routes while blocking dashboard routes', () => {
    const pubReq = new NextRequest('https://sophia.agencyos.network/vi/pricing', {
      headers: { accept: 'text/markdown, text/html;q=0.8' },
    });
    expect(isAeoMarkdownNegotiatedRequest(pubReq)).toBe(true);
    const res = handleAeoMarkdownNegotiation(pubReq, new Headers(), 'nonce-123', false);
    expect(res).not.toBeNull();
    expect(res?.headers.get('Vary')).toContain('Accept');

    const dashReq = new NextRequest('https://sophia.agencyos.network/vi/dashboard', {
      headers: { accept: 'text/markdown' },
    });
    expect(isAeoMarkdownNegotiatedRequest(dashReq)).toBe(false);
  });
});
