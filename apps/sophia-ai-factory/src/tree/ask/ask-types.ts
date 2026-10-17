/**
 * Bilingual Natural Language Ask Router — Type Definitions
 *
 * Layer: tree/ask
 * @module tree/ask/ask-types
 */

export type CanonicalIntentId =
  | 'cook'
  | 'fix'
  | 'test'
  | 'plan'
  | 'brainstorm'
  | 'deploy'
  | 'docs'
  | 'analytics'
  | 'security'
  | 'audit';

export type CanonicalTargetCommand =
  | '/cook'
  | '/fix'
  | '/test'
  | '/plan'
  | '/brainstorm'
  | 'deploy'
  | '/docs'
  | 'analytics-report'
  | '/security-scan'
  | '/audit-compliance';

export type RouteMode =
  | 'command-routed'
  | 'architecture-consultation'
  | 'unknown-command-rejected';

export interface IntentCategoryDefinition {
  readonly id: CanonicalIntentId;
  readonly targetCommand: CanonicalTargetCommand;
  readonly nameVi: string;
  readonly nameEn: string;
  readonly descriptionVi: string;
  readonly descriptionEn: string;
  readonly keywordsVi: readonly string[];
  readonly keywordsEn: readonly string[];
}

export interface FourAdvisorConsultation {
  readonly systemsDesigner: { readonly vi: string; readonly en: string };
  readonly technologyStrategist: { readonly vi: string; readonly en: string };
  readonly scalabilityConsultant: { readonly vi: string; readonly en: string };
  readonly riskAnalyst: { readonly vi: string; readonly en: string };
  readonly synthesis: { readonly vi: string; readonly en: string };
}

export interface AskRouteResult {
  readonly query: string;
  readonly mode: RouteMode;
  readonly matchedIntent?: IntentCategoryDefinition;
  readonly matchedKeyword?: string;
  readonly matchedLanguage?: 'vi' | 'en';
  readonly targetCommand?: CanonicalTargetCommand;
  readonly consultation?: FourAdvisorConsultation;
  readonly rejectionReason?: { readonly vi: string; readonly en: string };
  readonly outputMessageVi: string;
  readonly outputMessageEn: string;
}
