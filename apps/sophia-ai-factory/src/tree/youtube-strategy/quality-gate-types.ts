/**
 * Contracts for the pre-publish YouTube quality gate.
 */

export interface QualityCheckResult {
  readonly passed: boolean;
  readonly violations: readonly string[];
  readonly warnings: readonly string[];
}

export interface ContentArtifact {
  readonly title?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly script?: string;
  readonly topic?: string;
  readonly publishedAt?: Date;
  readonly assetUrls?: readonly string[];
}

export interface QualityGateConfig {
  readonly maxTitleLength: number;
  readonly minTitleLength: number;
  readonly maxDescriptionLength: number;
  readonly maxTagCount: number;
  readonly maxTagCharTotal: number;
  readonly minScriptWordCount: number;
  readonly maxScriptWordCount: number;
  readonly deduplicationWindowDays: number;
  readonly requiredAssetCount: number;
}
