import { describe, it, expect } from 'vitest';
import { runQualityChecks, type ContentArtifact, type QualityGateConfig } from '../quality-gate';

describe('quality-gate', () => {
  const defaultConfig: QualityGateConfig = {
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

  describe('runQualityChecks', () => {
    it('passes for well-formed artifact', () => {
      const scriptContent = 'This is a comprehensive Python programming tutorial that covers all the essential topics. '.repeat(25);
      const artifact: ContentArtifact = {
        title: 'Python Programming Tutorial 2024',
        description: 'A comprehensive guide to Python programming covering all the basics and advanced topics.',
        tags: ['python', 'programming', 'tutorial'],
        script: scriptContent,
        topic: 'Python Programming',
        assetUrls: ['https://example.com/video.mp4'],
      };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('fails for missing title', () => {
      const artifact: ContentArtifact = { title: '' };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.passed).toBe(false);
      expect(result.violations.some((f) => f.includes('Title'))).toBe(true);
    });

    it('fails for title too short', () => {
      const artifact: ContentArtifact = { title: 'Hi' };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.passed).toBe(false);
      expect(result.violations.some((f) => f.includes('too short'))).toBe(true);
    });

    it('warns for missing description', () => {
      const artifact: ContentArtifact = { description: '' };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.warnings.some((w) => w.includes('Description'))).toBe(true);
    });

    it('warns for very short description', () => {
      const artifact: ContentArtifact = { description: 'Short desc' };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.warnings.some((w) => w.includes('short'))).toBe(true);
    });

    it('warns for no tags', () => {
      const artifact: ContentArtifact = { tags: [] };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.warnings.some((w) => w.includes('tags'))).toBe(true);
    });

    it('fails for too many tags', () => {
      const artifact: ContentArtifact = { tags: Array.from({ length: 35 }, (_, i) => `tag${i}`) };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.passed).toBe(false);
      expect(result.violations.some((f) => f.includes('Too many'))).toBe(true);
    });

    it('warns for duplicate tags', () => {
      const artifact: ContentArtifact = { tags: ['python', 'python', 'tutorial'] };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.warnings.some((w) => w.includes('Duplicate'))).toBe(true);
    });

    it('warns for no script content', () => {
      const artifact: ContentArtifact = { script: '' };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.warnings.some((w) => w.includes('script'))).toBe(true);
    });

    it('fails for script too short', () => {
      const artifact: ContentArtifact = { script: 'A few words' };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.passed).toBe(false);
      expect(result.violations.some((f) => f.includes('too short'))).toBe(true);
    });

    it('detects duplicate topic', () => {
      const artifact: ContentArtifact = { topic: 'Python' };
      const result = runQualityChecks(artifact, ['python', 'java'], defaultConfig);
      expect(result.passed).toBe(false);
      expect(result.violations.some((f) => f.includes('Python'))).toBe(true);
    });

    it('warns for no asset URLs', () => {
      const artifact: ContentArtifact = { assetUrls: [] };
      const result = runQualityChecks(artifact, [], defaultConfig);
      expect(result.warnings.some((w) => w.includes('asset'))).toBe(true);
    });
  });
});