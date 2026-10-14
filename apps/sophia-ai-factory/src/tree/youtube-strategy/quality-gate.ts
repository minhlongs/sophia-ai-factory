/**
 * Pre-publish quality checks for YouTube content.
 * Ported from Lumen's operator-service quality gates.
 */

import type { ContentArtifact, QualityCheckResult, QualityGateConfig } from './quality-gate-types';
import {
  checkTitle,
  checkDescription,
  checkTags,
  checkScript,
  checkTopicUniqueness,
  checkAssets,
} from './quality-gate-checks';

export type { QualityCheckResult, ContentArtifact, QualityGateConfig } from './quality-gate-types';

const DEFAULT_CONFIG: QualityGateConfig = {
  maxTitleLength: 100,
  minTitleLength: 10,
  maxDescriptionLength: 5000,
  maxTagCount: 30,
  maxTagCharTotal: 500,
  minScriptWordCount: 200,
  maxScriptWordCount: 10000,
  deduplicationWindowDays: 90,
  requiredAssetCount: 1,
};

/**
 * Run all quality checks against a content artifact.
 */
export function runQualityChecks(
  artifact: ContentArtifact,
  recentTopics: readonly string[],
  config: QualityGateConfig = DEFAULT_CONFIG,
): QualityCheckResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  checkTitle(artifact.title, config, violations, warnings);
  checkDescription(artifact.description, config, violations, warnings);
  checkTags(artifact.tags, config, violations, warnings);
  checkScript(artifact.script, config, violations, warnings);
  checkTopicUniqueness(artifact.topic, recentTopics, config, violations);
  checkAssets(artifact.assetUrls, config, violations, warnings);

  return {
    passed: violations.length === 0,
    violations,
    warnings,
  };
}
