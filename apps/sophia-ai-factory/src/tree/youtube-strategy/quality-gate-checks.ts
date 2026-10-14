/**
 * Individual rule checks for the pre-publish YouTube quality gate.
 */

import type { QualityGateConfig } from './quality-gate-types';

export function checkTitle(
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

export function checkDescription(
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

export function checkTags(
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

export function checkScript(
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

export function checkTopicUniqueness(
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

export function checkAssets(
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
