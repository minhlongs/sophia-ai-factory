/**
 * Foundational types for Sophia AI Factory Dual-Read AEO/GEO Architecture.
 * Layer: seed/aeo (zero upward imports).
 */

export type AeoLocale = 'vi' | 'en';

export type AeoPageSurface =
  | 'home'
  | 'pricing'
  | 'guide'
  | 'affiliate'
  | 'status'
  | 'ai-video-hub'
  | 'ai-video-niche';

export interface AeoCitationMetric {
  readonly label: string;
  readonly value: string;
  readonly sourceNote: string;
}

export interface AeoComparisonRow {
  readonly dimension: string;
  readonly sophiaValue: string;
  readonly legacyValue: string;
  readonly advantageMetric: string;
}

export interface AeoFaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface AeoHowToStep {
  readonly stepNumber: number;
  readonly name: string;
  readonly text: string;
}

export interface DualReadPagePayload {
  readonly pageKey: string;
  readonly surface: AeoPageSurface;
  readonly locale: AeoLocale;
  readonly canonicalUrl: string;
  readonly title: string;
  readonly answerFirstSummary: string;
  readonly lastVerifiedIso: string;
  readonly metrics: readonly AeoCitationMetric[];
  readonly comparisonRows: readonly AeoComparisonRow[];
  readonly faqs: readonly AeoFaqItem[];
  readonly howToSteps?: readonly AeoHowToStep[];
  readonly nicheSlug?: string;
}

export interface AgentCapabilityEndpoint {
  readonly path: string;
  readonly method: 'GET' | 'POST';
  readonly contentType: string;
  readonly description: string;
  readonly authRequired: boolean;
}

export interface AgentDiscoveryManifest {
  readonly schemaVersion: '2027.1';
  readonly name: string;
  readonly canonicalUrl: string;
  readonly description: string;
  readonly locales: readonly AeoLocale[];
  readonly dualReadProtocol: {
    readonly acceptHeader: 'text/markdown';
    readonly markdownSuffix: '.md';
    readonly llmsIndexUrl: string;
    readonly llmsFullUrl: string;
  };
  readonly billingRails: readonly string[];
  readonly byokProviders: readonly string[];
  readonly affiliateNetworks: readonly string[];
  readonly supportedNicheCount: number;
  readonly endpoints: readonly AgentCapabilityEndpoint[];
}
