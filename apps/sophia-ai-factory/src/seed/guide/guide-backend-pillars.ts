/**
 * guide-backend-pillars.ts
 * Type definitions and core pillar identifiers for the 8 Sophia AI Factory backend pillars.
 * Layer: seed/guide
 */

export interface BackendPillar {
  readonly id: string;
  readonly number: number;
  readonly icon: string;
  readonly title: { readonly vi: string; readonly en: string };
  readonly tag: { readonly vi: string; readonly en: string };
  readonly badge: string;
  readonly description: { readonly vi: string; readonly en: string };
  readonly capabilities: ReadonlyArray<{ readonly vi: string; readonly en: string }>;
  readonly representativeRoutes: readonly string[];
  readonly representativeJobs: readonly string[];
  readonly safetyPillar: { readonly vi: string; readonly en: string };
}

export interface PipelineStage {
  readonly step: number;
  readonly name: { readonly vi: string; readonly en: string };
  readonly subtitle: { readonly vi: string; readonly en: string };
  readonly input: { readonly vi: string; readonly en: string };
  readonly engine: { readonly vi: string; readonly en: string };
  readonly output: { readonly vi: string; readonly en: string };
  readonly sampleCommand: string;
  readonly sampleResult: string;
}
