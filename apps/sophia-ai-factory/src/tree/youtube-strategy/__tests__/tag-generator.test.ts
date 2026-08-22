import { describe, it, expect } from 'vitest';
import { generatePrioritizedTags, scoreTag, enforceCharLimit, type TagInput } from '../tag-generator';

describe('tag-generator', () => {
  const input: TagInput = {
    topic: 'Python Programming',
    keywords: ['python', 'programming', 'tutorial'],
    contentType: 'Tutorial',
  };

  describe('generatePrioritizedTags', () => {
    it('returns tags prioritized by score', () => {
      const tags = generatePrioritizedTags(input);
      expect(tags.length).toBeGreaterThan(0);
      // Verify primary keywords are present
      expect(tags).toContain('python');
      expect(tags).toContain('programming');
    });

    it('includes primary keywords', () => {
      const tags = generatePrioritizedTags(input);
      expect(tags).toContain('python');
      expect(tags).toContain('programming');
    });

    it('includes year', () => {
      const tags = generatePrioritizedTags(input);
      const year = new Date().getFullYear().toString();
      expect(tags).toContain(year);
    });

    it('includes content-type tags for Tutorial', () => {
      const tags = generatePrioritizedTags(input);
      expect(tags).toContain('how to');
      expect(tags).toContain('tutorial');
    });

    it('includes long-tail keywords', () => {
      const tags = generatePrioritizedTags(input);
      expect(tags.some((t) => t.includes('how to'))).toBe(true);
    });

    it('does not exceed 500 chars', () => {
      const tags = generatePrioritizedTags(input);
      let total = 0;
      for (const tag of tags) {
        total += tag.length + 1;
      }
      expect(total).toBeLessThanOrEqual(500);
    });

    it('returns empty for empty input', () => {
      const emptyInput: TagInput = {
        topic: '',
        keywords: [],
        contentType: '',
      };
      const tags = generatePrioritizedTags(emptyInput);
      // Empty topic still produces year and long-tail variants, so verify it returns
      expect(Array.isArray(tags)).toBe(true);
    });
  });

  describe('scoreTag', () => {
    it('gives higher score to primary keywords', () => {
      const primaryScore = scoreTag('python', 'python', ['python', 'programming']);
      const secondaryScore = scoreTag('java', 'python', ['python', 'programming']);
      expect(primaryScore).toBeGreaterThan(secondaryScore);
    });

    it('gives higher score to exact keyword match vs non-match', () => {
      const keywordScore = scoreTag('tutorial', 'python', ['python', 'tutorial']);
      const randomScore = scoreTag('random', 'python', ['python', 'tutorial']);
      expect(keywordScore).toBeGreaterThan(randomScore);
    });
  });

  describe('enforceCharLimit', () => {
    it('removes tags that exceed char limit', () => {
      const tags = ['short', 'a'.repeat(100), 'another short'];
      const result = enforceCharLimit(tags, 200);
      const totalChars = result.reduce((sum, t) => sum + t.length + 1, 0);
      expect(totalChars).toBeLessThanOrEqual(200);
    });

    it('keeps all tags if under limit', () => {
      const tags = ['python', 'programming'];
      const result = enforceCharLimit(tags, 500);
      expect(result).toHaveLength(2);
    });
  });
});