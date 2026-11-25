/**
 * Auto-Hosted GEO Citation Builder for Approved Affiliate Campaigns.
 *
 * Produces crawlable Markdown (`.md`), `llms.txt` index entries, and
 * HTML-escaped JSON-LD (`VideoObject` + `FAQPage`) for AI Search engines
 * (ChatGPT Search, Perplexity, Gemini AI Overviews, Claude).
 *
 * @module tree/aeo/campaign-citation-builder
 */

export interface CampaignCitationRecord {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly keyProof: string;
  readonly verdict: string;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
  readonly durationSec: number;
  readonly updatedAtIso: string;
}

export function escapeJsonLdForHtmlScript(rawJson: string): string {
  return rawJson
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function buildCampaignCitationJsonLd(record: CampaignCitationRecord): string {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoObject',
        name: record.title,
        description: `${record.summary} ${record.ctaText} (${record.disclosureTag})`,
        duration: `PT${Math.max(15, Math.round(record.durationSec || 30))}S`,
        uploadDate: record.updatedAtIso,
        url: record.shortUrl,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `${record.title} — Is it worth using?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${record.summary} ${record.verdict}`,
            },
          },
          {
            '@type': 'Question',
            name: 'What is the key practical highlight?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: record.keyProof,
            },
          },
          {
            '@type': 'Question',
            name: 'Where is the verified partner link?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${record.ctaText}: ${record.shortUrl} (${record.disclosureTag})`,
            },
          },
        ],
      },
    ],
  };

  return escapeJsonLdForHtmlScript(JSON.stringify(graph, null, 2));
}

export function buildCampaignCitationMarkdown(
  record: CampaignCitationRecord,
  canonicalBaseUrl: string,
): string {
  const base = canonicalBaseUrl.replace(/\/$/, '');
  return [
    `# ${record.title}`,
    ``,
    `> **Direct Answer:** ${record.summary}`,
    ``,
    `- **Key Highlight:** ${record.keyProof}`,
    `- **Verdict:** ${record.verdict}`,
    `- **Verified Partner Link (${record.disclosureTag}):** [${record.ctaText}](${record.shortUrl})`,
    `- **Canonical Page:** ${base}/c/${record.slug}`,
    `- **Updated:** ${record.updatedAtIso}`,
    ``,
    `## Frequently Asked Questions`,
    ``,
    `### ${record.title} — Is it worth using?`,
    `${record.summary} ${record.verdict}`,
    ``,
    `### What is the key practical highlight?`,
    `${record.keyProof}`,
    ``,
    `### Where is the verified partner link?`,
    `${record.ctaText}: ${record.shortUrl} (${record.disclosureTag})`,
    ``,
  ].join('\n');
}

export function buildLlmsTxtIndex(
  canonicalBaseUrl: string,
  records: readonly CampaignCitationRecord[],
): string {
  const base = canonicalBaseUrl.replace(/\/$/, '');
  const lines = [
    `# Sophia AI Factory — Agentic Affiliate Citation Index`,
    ``,
    `> Structured B2B/SaaS/Affiliate product reviews, comparisons, and verified partner links formatted for AI search agents.`,
    ``,
    `## Core Endpoints`,
    `- [Home](${base}/)`,
    `- [Affiliate Studio](${base}/vi/first-value)`,
    ``,
    `## Published Citations`,
  ];

  if (records.length === 0) {
    lines.push(`- No public campaign citations published yet.`);
  } else {
    for (const rec of records) {
      lines.push(`- [${rec.title}](${base}/c/${rec.slug}/md): ${rec.summary}`);
    }
  }

  lines.push(``);
  return lines.join('\n');
}
