/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  buildCampaignCitationJsonLd,
  buildCampaignCitationMarkdown,
  buildLlmsTxtIndex,
  escapeJsonLdForHtmlScript,
} from '../campaign-citation-builder';
import { GET as getLlmsTxt } from '@/app/llms.txt/route';
import { GET as getCitationMd } from '@/app/c/[slug]/md/route';
import CampaignCitationPage from '@/app/c/[slug]/page';
import {
  buildConciergeDeepLinkReply,
  buildConciergeReply,
  handleConciergeAsk,
  handleConciergeStart,
} from '@/tree/telegram/handlers/concierge-handler';

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

const mockSendTelegramMessage = vi.fn();
vi.mock('@/tree/telegram/telegram-client', () => ({
  sendTelegramMessage: (...args: unknown[]) => mockSendTelegramMessage(...args),
}));

const SAMPLE_RECORD = {
  slug: 'notion-ai-2026',
  title: 'Notion AI Review 2026',
  summary: 'Fast workspace AI for small teams.',
  keyProof: 'Summarizes meetings in 5 seconds.',
  verdict: 'Worth it for teams using Notion daily.',
  ctaText: 'Try Notion AI',
  shortUrl: 'https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/notion-ai-2026',
  disclosureTag: '#ad',
  durationSec: 180,
  updatedAtIso: '2026-11-25T00:00:00Z',
};

describe('Auto-Hosted GEO Citation & @Sophia_Bbot Concierge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('escapes HTML script breakout characters in JSON-LD while remaining valid JSON', () => {
    const escaped = escapeJsonLdForHtmlScript('{"a":"</script>&<img>"}');
    expect(escaped).not.toContain('</script>');
    expect(JSON.parse(escaped)).toEqual({ a: '</script>&<img>' });

    const jsonLd = buildCampaignCitationJsonLd(SAMPLE_RECORD);
    const parsed = JSON.parse(jsonLd) as { '@graph': Array<{ '@type': string }> };
    expect(parsed['@graph'].map((n) => n['@type'])).toEqual(['VideoObject', 'FAQPage']);
  });

  it('builds Markdown citation and llms.txt index on 100% Cloudflare Workers URL', async () => {
    const md = buildCampaignCitationMarkdown(
      SAMPLE_RECORD,
      'https://sophia-ai-factory.agencyos-openclaw.workers.dev',
    );
    expect(md).toContain('# Notion AI Review 2026');
    expect(md).toContain('/c/notion-ai-2026');

    const index = buildLlmsTxtIndex(
      'https://sophia-ai-factory.agencyos-openclaw.workers.dev',
      [SAMPLE_RECORD],
    );
    expect(index).toContain('/c/notion-ai-2026/md');

    const llmsRes = await getLlmsTxt();
    expect(llmsRes.status).toBe(200);
    expect(await llmsRes.text()).toContain('sophia-ai-factory.agencyos-openclaw.workers.dev');

    const mdRes = await getCitationMd(
      new NextRequest('http://localhost/c/notion-ai-2026/md'),
      { params: Promise.resolve({ slug: 'notion-ai-2026' }) },
    );
    expect(mdRes.status).toBe(200);
    expect(await mdRes.text()).toContain('notion-ai-2026');

    const badRes = await getCitationMd(
      new NextRequest('http://localhost/c/bad%20slug!/md'),
      { params: Promise.resolve({ slug: 'bad slug!' }) },
    );
    expect(badRes.status).toBe(400);

    const pageEl = await CampaignCitationPage({
      params: Promise.resolve({ slug: 'notion-ai-2026' }),
    });
    expect(pageEl).toBeTruthy();

    await expect(
      CampaignCitationPage({ params: Promise.resolve({ slug: 'bad slug!' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('handles @Sophia_Bbot /ask and /start concierge_<slug> commands', async () => {
    expect(buildConciergeReply('')).toContain('/llms.txt');
    expect(buildConciergeReply('Notion AI')).toContain('/api/r/notion-ai');
    expect(buildConciergeDeepLinkReply('notion-ai-2026')).toContain('/c/notion-ai-2026');

    await handleConciergeAsk('12345', 'CRM SaaS');
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('/api/r/crm-saas'),
    );

    await handleConciergeStart('12345', 'notion-ai-2026');
    expect(mockSendTelegramMessage).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('notion-ai-2026'),
    );
  });
});
