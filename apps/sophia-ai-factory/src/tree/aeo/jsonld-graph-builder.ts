/**
 * Deep Schema.org JSON-LD @graph builder for Sophia AI Factory AEO/GEO.
 * Connects Organization, SoftwareApplication, OfferCatalog, FAQPage, and HowTo.
 * Layer: tree/aeo (imports only from seed/*).
 */

import { TIER_CONFIGS } from '@/seed/config/tiers/tier-configs';
import { SOPHIA_BASE_URL, buildEeatTelemetryProof, type DualReadPagePayload } from '@/seed/aeo';

export interface JsonLdGraphDocument {
  readonly '@context': 'https://schema.org';
  readonly '@graph': readonly Record<string, unknown>[];
}

export function buildJsonLdGraph(payload: DualReadPagePayload): JsonLdGraphDocument {
  const orgId = `${SOPHIA_BASE_URL}/#organization`;
  const appId = `${SOPHIA_BASE_URL}/#software-application`;
  const pageId = `${payload.canonicalUrl}#webpage`;
  const proof = payload.telemetryProof ?? buildEeatTelemetryProof();

  const offers = Object.entries(TIER_CONFIGS).map(([tierKey, cfg]) => ({
    '@type': 'Offer',
    '@id': `${SOPHIA_BASE_URL}/#offer-${tierKey.toLowerCase()}`,
    name: `Sophia AI Factory — ${cfg.name} (${tierKey})`,
    price: String(cfg.price),
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: `${SOPHIA_BASE_URL}/${payload.locale}/pricing`,
    description: `${cfg.limits.youtubeChannels} YouTube channels, ${cfg.limits.videoTemplates} AI video templates.`,
  }));

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': orgId,
      name: 'Sophia AI Factory',
      url: SOPHIA_BASE_URL,
      description: payload.answerFirstSummary,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': appId,
      name: 'Sophia AI Factory',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Cloudflare Workers Edge',
      softwareVersion: proof.deployedSha,
      provider: { '@id': orgId },
      offers,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'deployedSha', value: proof.deployedSha },
        { '@type': 'PropertyValue', name: 'verifiedIsoDate', value: proof.verifiedIsoDate },
        { '@type': 'PropertyValue', name: 'activeNichesCount', value: String(proof.activeNichesCount) },
        { '@type': 'PropertyValue', name: 'byokZeroMarkup', value: String(proof.byokZeroMarkup) },
      ],
    },
    {
      '@type': 'WebPage',
      '@id': pageId,
      url: payload.canonicalUrl,
      name: payload.title,
      inLanguage: payload.locale,
      dateModified: proof.verifiedIsoDate,
      description: payload.answerFirstSummary,
      isPartOf: { '@id': appId },
      about: { '@id': orgId },
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['[data-aeo-citation="answer-first"]', '[data-aeo-citation="comparison-matrix"]'],
      },
    },
  ];

  if (payload.faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${payload.canonicalUrl}#faq`,
      isPartOf: { '@id': pageId },
      mainEntity: payload.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    });
  }

  if (payload.howToSteps && payload.howToSteps.length > 0) {
    graph.push({
      '@type': 'HowTo',
      '@id': `${payload.canonicalUrl}#howto`,
      name: payload.title,
      description: payload.answerFirstSummary,
      step: payload.howToSteps.map((s) => ({
        '@type': 'HowToStep',
        position: s.stepNumber,
        name: s.name,
        text: s.text,
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function serializeJsonLdSafe(doc: JsonLdGraphDocument): string {
  return JSON.stringify(doc).replace(/</g, '\\u003c');
}

