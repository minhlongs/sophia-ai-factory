/**
 * Stitch Director's Control Deck (Project 8279482791013273159)
 * Foundational Seed Layer Types — Zero external layer dependencies
 */

export type ControlDeckScreenId =
  | 'dashboard'
  | 'ask-advisors'
  | 'video-studio'
  | 'billing-revenue'
  | 'setup-wizard'
  | 'agency-portal'
  | 'mobile-companion'
  | 'pricing'
  | 'style-guide'
  | 'creative-economy'
  | 'youtube-automation'
  | 'playbooks'
  | 'publish-queue'
  | 'marketplace'
  | 'my-sops'
  | 'challenges'
  | 'handover-runbooks'
  | 'system-health';

export type StitchScreenId = ControlDeckScreenId;

export type ControlDeckPillar = 'studio' | 'webapp' | 'mobile' | 'marketing';

export interface BilingualText {
  readonly en: string;
  readonly vi: string;
}

export interface StitchScreenSpec {
  readonly id: ControlDeckScreenId;
  readonly index: number;
  readonly order?: number;
  readonly navLabel: BilingualText;
  readonly stitchProjectId: string;
  readonly stitchScreenId: string;
  readonly routeHtml: string;
  readonly htmlFile?: string;
  readonly routeBind?: string;
  readonly pillar: ControlDeckPillar;
  readonly title: BilingualText;
  readonly subtitle: BilingualText;
  readonly heroWidget?: BilingualText;
  readonly primaryKpiLabel: BilingualText;
  readonly primaryKpiValue: string;
  readonly statusBadge: BilingualText;
  readonly highlights: readonly BilingualText[];
  readonly keyMetrics?: readonly BilingualText[];
}

export interface MabArmTelemetry {
  readonly armId: string;
  readonly hookName: BilingualText;
  readonly alpha: number;
  readonly beta: number;
  readonly winProbabilityPct: number;
  readonly halfKellyAllocationPct: number;
  readonly roasMultiplier: string;
  readonly isChampion: boolean;
}

export interface AdvisorNodeTelemetry {
  readonly advisorId: 'sun-tzu' | 'munger' | 'feynman' | 'ogilvy';
  readonly personaTitle: BilingualText;
  readonly domainFocus: BilingualText;
  readonly verdictSummary: BilingualText;
  readonly confidenceScorePct: number;
  readonly accentToken: string;
}

export interface VideoTimelineTrack {
  readonly trackId: string;
  readonly trackCode: 'V1' | 'A1' | 'A2' | 'SUB';
  readonly label: BilingualText;
  readonly modelBadge: string;
  readonly startTimecode: string;
  readonly durationTimecode: string;
  readonly progressPct: number;
  readonly accentColorVar: string;
}

export interface ControlDeckPaymentEntry {
  readonly txId: string;
  readonly provider: BilingualText;
  readonly grossAmountUsd: string;
  readonly affiliateSplitUsd?: string;
  readonly merkleLeafHash?: string;
  readonly status: BilingualText;
  readonly timestampUtc: string;
  readonly source: 'sample' | 'account';
}

export interface StitchTokenSwatches {
  readonly name: string;
  readonly cssVar: string;
  readonly colorValue: string;
  readonly role: BilingualText;
}

export interface ControlDeckDataset {
  readonly projectId: string;
  readonly designSystemAssetId: string;
  readonly directionName: BilingualText;
  readonly screens: readonly StitchScreenSpec[];
  readonly mabArms: readonly MabArmTelemetry[];
  readonly advisors: readonly AdvisorNodeTelemetry[];
  readonly timelineTracks: readonly VideoTimelineTrack[];
  readonly settlements: readonly ControlDeckPaymentEntry[];
  readonly tokenSwatches: readonly StitchTokenSwatches[];
}
