/**
 * Pure Markdown serializer for Sophia AI Factory Dual-Read Protocol.
 * Zero DOM parsing at runtime (< 2ms execution on Cloudflare Workers).
 * Layer: tree/aeo (imports only from seed/*).
 */

import { TIER_CONFIGS } from '@/seed/config/tiers/tier-configs';
import { NICHE_SLUGS, NICHE_LABELS } from '@/seed/config/niche-list';
import {
  SOPHIA_BASE_URL,
  VERIFIED_ISO_DATE,
  AFFILIATE_NETWORKS_LIST,
  BYOK_PROVIDERS_LIST,
  type DualReadPagePayload,
} from '@/seed/aeo';

export function serializePageToMarkdown(payload: DualReadPagePayload): string {
  const tokenEstimate = Math.max(120, Math.ceil(payload.answerFirstSummary.length * 1.8));
  const lines: string[] = [
    '---',
    `title: "${payload.title.replace(/"/g, '\\"')}"`,
    `canonical: "${payload.canonicalUrl}"`,
    `locale: "${payload.locale}"`,
    `surface: "${payload.surface}"`,
    `last_verified: "${payload.lastVerifiedIso}"`,
    `estimated_tokens: ${tokenEstimate}`,
    '---',
    '',
    `# ${payload.title}`,
    '',
    `> **Answer-First Summary (Ground Truth):** ${payload.answerFirstSummary}`,
    '',
    '## Key Verified Metrics',
    '',
    ...payload.metrics.map((m) => `- **${m.label}:** ${m.value} _(${m.sourceNote})_`),
    '',
    '## Verified Comparison Matrix',
    '',
    '| Dimension | Sophia AI Factory | Legacy Approach | Verified Advantage |',
    '| :--- | :--- | :--- | :--- |',
    ...payload.comparisonRows.map(
      (r) => `| ${r.dimension} | ${r.sophiaValue} | ${r.legacyValue} | **${r.advantageMetric}** |`,
    ),
    '',
  ];

  if (payload.howToSteps && payload.howToSteps.length > 0) {
    lines.push('## Step-by-Step Execution Flow', '');
    for (const step of payload.howToSteps) {
      lines.push(`${step.stepNumber}. **${step.name}:** ${step.text}`);
    }
    lines.push('');
  }

  if (payload.faqs.length > 0) {
    lines.push('## Frequently Asked Questions (FAQ)', '');
    for (const faq of payload.faqs) {
      lines.push(`### ${faq.question}`, '', faq.answer, '');
    }
  }

  lines.push(
    '---',
    `*Machine-Readable Dual-Read Endpoint — Discovery Index: ${SOPHIA_BASE_URL}/llms-full.txt*`,
  );
  return lines.join('\n');
}

export function buildLlmsIndexText(): string {
  const b = TIER_CONFIGS.BASIC;
  const p = TIER_CONFIGS.PREMIUM;
  const e = TIER_CONFIGS.ENTERPRISE;
  const m = TIER_CONFIGS.MASTER;
  return [
    '# Sophia AI Factory (Dual-Read AEO/GEO Edition)',
    '',
    `> Autonomous BYOK AI Video & Affiliate Revenue-as-a-Service (RaaS) platform on Cloudflare Workers. Supports ${NICHE_SLUGS.length} industry niches, ${AFFILIATE_NETWORKS_LIST.length} affiliate networks, and USDT settlement via NOWPayments.`,
    '',
    '## Canonical Machine Endpoints',
    `- Full Ground-Truth Corpus: ${SOPHIA_BASE_URL}/llms-full.txt`,
    `- Agent Discovery Manifest: ${SOPHIA_BASE_URL}/.well-known/agent.json`,
    `- Content Negotiation: Send "Accept: text/markdown" or append ".md" to any public route`,
    '',
    '## Verified Pricing Tiers (Source: TIER_CONFIGS)',
    `- BASIC (${b.priceDisplay}): ${b.limits.youtubeChannels} YouTube channels, ${b.limits.videoTemplates} templates`,
    `- PREMIUM (${p.priceDisplay}): ${p.limits.youtubeChannels} YouTube channels, ${p.limits.videoTemplates} templates [Recommended]`,
    `- ENTERPRISE (${e.priceDisplay}): ${e.limits.youtubeChannels} YouTube channels, ${e.limits.videoTemplates} templates`,
    `- MASTER (${m.priceDisplay}): ${m.limits.youtubeChannels} YouTube channels, ${m.limits.videoTemplates} templates`,
    '',
    '## Core Public Surfaces',
    `- Home (VI/EN): ${SOPHIA_BASE_URL}/vi | ${SOPHIA_BASE_URL}/en`,
    `- Pricing: ${SOPHIA_BASE_URL}/vi/pricing | ${SOPHIA_BASE_URL}/en/pricing`,
    `- Guide Hub: ${SOPHIA_BASE_URL}/vi/guide | ${SOPHIA_BASE_URL}/en/guide`,
    `- AI Video Niches (${NICHE_SLUGS.length} verticals): ${SOPHIA_BASE_URL}/vi/ai-video | ${SOPHIA_BASE_URL}/en/ai-video`,
    `- System Status: ${SOPHIA_BASE_URL}/vi/status`,
  ].join('\n');
}

export function buildLlmsFullCorpusText(): string {
  const indexHeader = buildLlmsIndexText();
  const nicheLines = NICHE_SLUGS.map((slug) => {
    const lbl = NICHE_LABELS[slug] ?? { en: slug, vi: slug };
    return `- **${lbl.en} / ${lbl.vi}** (\`${slug}\`): ${SOPHIA_BASE_URL}/en/ai-video/${slug} | ${SOPHIA_BASE_URL}/vi/ai-video/${slug}`;
  });

  return [
    indexHeader,
    '',
    '## BYOK Architecture & Protected Flows',
    `- **BYOK Providers:** ${BYOK_PROVIDERS_LIST.join(', ')}`,
    `- **Affiliate Networks (${AFFILIATE_NETWORKS_LIST.length}):** ${AFFILIATE_NETWORKS_LIST.join(', ')}`,
    '- **Protected Flows:** (1) Setup Wizard (`/vi/setup`, `/en/setup`), (2) Telegram Bot (`@Sophia_Bbot`), (3) NOWPayments IPN Webhook.',
    '',
    `## All ${NICHE_SLUGS.length} Supported AI Video Industry Niches`,
    ...nicheLines,
    '',
    `*Last Verified: ${VERIFIED_ISO_DATE}*`,
  ].join('\n');
}
