/**
 * Pre-publish quality checks for YouTube content.
 * Ported from Lumen's operator-service quality gates.
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

function checkTitle(
  title: string | undefined,
  config: QualityGateConfig,
  violations: string[],
  warnings: string[],
): void {
  if (!title || title.trim().length === 0) {
    violations.push('Title is required');
    return;
  }
  if (title.length < config.minTitleLength) {
    violations.push(`Title too short: ${title.length} chars (min ${config.minTitleLength})`);
  }
  if (title.length > config.maxTitleLength) {
    violations.push(`Title too long: ${title.length} chars (max ${config.maxTitleLength})`);
  }
  if (title !== title.trim()) {
    warnings.push('Title has leading/trailing whitespace');
  }
}

function checkDescription(
  description: string | undefined,
  config: QualityGateConfig,
  violations: string[],
  warnings: string[],
): void {
  if (!description || description.trim().length === 0) {
    warnings.push('Description is empty');
    return;
  }
  if (description.length > config.maxDescriptionLength) {
    violations.push(`Description exceeds ${config.maxDescriptionLength} chars`);
  }
  if (description.length < 100) {
    warnings.push('Description is very short (< 100 chars)');
  }
}

function checkTags(
  tags: readonly string[] | undefined,
  config: QualityGateConfig,
  violations: string[],
  warnings: string[],
): void {
  if (!tags || tags.length === 0) {
    warnings.push('No tags provided');
    return;
  }
  if (tags.length > config.maxTagCount) {
    violations.push(`Too many tags: ${tags.length} (max ${config.maxTagCount})`);
  }
  const totalChars = tags.join(',').length;
  if (totalChars > config.maxTagCharTotal) {
    violations.push(`Tag total ${totalChars} chars exceeds ${config.maxTagCharTotal}`);
  }
  const uniqueTags = new Set(tags);
  if (uniqueTags.size < tags.length) {
    warnings.push('Duplicate tags detected');
  }
}

function checkScript(
  script: string | undefined,
  config: QualityGateConfig,
  violations: string[],
  warnings: string[],
): void {
  if (!script || script.trim().length === 0) {
    warnings.push('No script content');
    return;
  }
  const wordCount = script.split(/\s+/).length;
  if (wordCount < config.minScriptWordCount) {
    violations.push(`Script too short: ${wordCount} words (min ${config.minScriptWordCount})`);
  }
  if (wordCount > config.maxScriptWordCount) {
    warnings.push(`Script very long: ${wordCount} words`);
  }
}

function checkTopicUniqueness(
  topic: string | undefined,
  recentTopics: readonly string[],
  config: QualityGateConfig,
  violations: string[],
): void {
  if (!topic) return;
  const normalized = topic.toLowerCase().trim();
  const isDuplicate = recentTopics.some(
    (t) => t.toLowerCase().trim() === normalized,
  );
  if (isDuplicate) {
    violations.push(
      `Topic "${topic}" was used within the last ${config.deduplicationWindowDays} days`,
    );
  }
}

function checkAssets(
  assetUrls: readonly string[] | undefined,
  config: QualityGateConfig,
  violations: string[],
  warnings: string[],
): void {
  if (!assetUrls || assetUrls.length === 0) {
    warnings.push('No asset URLs provided');
    return;
  }
  if (assetUrls.length < config.requiredAssetCount) {
    violations.push(
      `Insufficient assets: ${assetUrls.length} (min ${config.requiredAssetCount})`,
    );
  }
}
