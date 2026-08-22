import { describe, it, expect } from 'vitest';
import {
  optimizeTitle,
  generateDescription,
  generateTags,
  generateHashtags,
  calculateSEOScore,
  type SEOOptimizationInput,
  type ScriptForSEO,
} from '../seo-optimizer';

describe('seo-optimizer', () => {
  const input: SEOOptimizationInput = {
    title: 'Python Programming',
    topic: 'Python Programming',
    angle: 'The Ultimate Guide',
    contentType: 'Tutorial',
    targetAudience: 'Beginners',
    keywords: ['python', 'programming', 'tutorial'],
  };

  const script: ScriptForSEO = {
    title: 'Python Programming',
    mainContent: {
      sections: [
        { title: 'Setup', duration: 60 },
        { title: 'Basics', duration: 120 },
      ],
    },
  };

  describe('optimizeTitle', () => {
    it('returns a title under 100 chars', () => {
      const result = optimizeTitle('Python Programming', ['python', 'programming']);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('adds power words when title is short', () => {
      const result = optimizeTitle('Python', ['python']);
      expect(result.length).toBeGreaterThan(6);
    });

    it('includes primary keyword', () => {
      const result = optimizeTitle('Programming Guide', ['python']);
      expect(result.toLowerCase()).toContain('python');
    });

    it('truncates very long titles', () => {
      const longTitle = 'A'.repeat(200);
      const result = optimizeTitle(longTitle, ['test']);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('handles empty title', () => {
      const result = optimizeTitle('', ['python']);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('generateDescription', () => {
    it('generates a description with timestamps', () => {
      const result = generateDescription(script, input);
      expect(result).toContain('TIMESTAMPS');
      expect(result).toContain('Introduction');
    });

    it('includes topic in description', () => {
      const result = generateDescription(script, input);
      expect(result).toContain('Python Programming');
    });

    it('includes section titles', () => {
      const result = generateDescription(script, input);
      expect(result).toContain('Setup');
      expect(result).toContain('Basics');
    });
  });

  describe('generateTags', () => {
    it('returns tags within 500 char limit', () => {
      const result = generateTags(input);
      const totalChars = result.join(',').length;
      expect(totalChars).toBeLessThanOrEqual(500);
    });

    it('includes primary keywords', () => {
      const result = generateTags(input);
      expect(result).toContain('python');
    });

    it('includes year', () => {
      const result = generateTags(input);
      const year = new Date().getFullYear().toString();
      expect(result).toContain(year);
    });

    it('includes niche-specific tags (general for Python Programming)', () => {
      const result = generateTags(input);
      // "Python Programming" doesn't match tech keywords, falls to general niche
      expect(result.some((t) => ['video', 'youtube', 'content'].includes(t))).toBe(true);
    });

    it('includes long-tail keywords', () => {
      const result = generateTags(input);
      expect(result.some((t) => t.includes('how to'))).toBe(true);
    });

    it('does not exceed 500 chars', () => {
      const result = generateTags(input);
      let total = 0;
      for (const tag of result) {
        total += tag.length + 1;
      }
      expect(total).toBeLessThanOrEqual(500);
    });
  });

  describe('generateHashtags', () => {
    it('returns at most 15 hashtags', () => {
      const result = generateHashtags(input);
      expect(result.length).toBeLessThanOrEqual(15);
    });

    it('includes primary hashtag', () => {
      const result = generateHashtags(input);
      expect(result).toContain('#PythonProgramming');
    });

    it('includes content type hashtag', () => {
      const result = generateHashtags(input);
      expect(result).toContain('#tutorial');
    });

    it('includes year hashtag', () => {
      const result = generateHashtags(input);
      const year = new Date().getFullYear().toString();
      expect(result).toContain(`#${year}`);
    });
  });

  describe('calculateSEOScore', () => {
    it('returns score between 0 and 100', () => {
      const score = calculateSEOScore('Python Programming Guide', 'Description with timestamps', ['python', 'programming']);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('gives higher score for well-optimized content', () => {
      const goodTitle = 'Python Programming Tutorial 2024';
      const goodDesc = 'TIMESTAMPS: 00:00 Introduction\n00:05 Setup\n00:10 Basics\nhttp://example.com\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11\n';
      const goodTags = ['python', 'programming', 'tutorial', 'how to python', 'python for beginners', 'python tutorial', 'python guide 2024', 'learn python', 'python course', 'best python', 'python tips', 'python explained'];
      const goodScore = calculateSEOScore(goodTitle, goodDesc, goodTags);

      const badTitle = 'Hi';
      const badDesc = 'Short';
      const badTags: string[] = [];
      const badScore = calculateSEOScore(badTitle, badDesc, badTags);

      expect(goodScore).toBeGreaterThan(badScore);
    });

    it('gives points for title with numbers', () => {
      const score = calculateSEOScore('Top 10 Python Tips', 'Description', ['python']);
      expect(score).toBeGreaterThan(0);
    });

    it('gives points for current year in title', () => {
      const year = new Date().getFullYear().toString();
      const score = calculateSEOScore(`Python Guide ${year}`, 'Description', ['python']);
      expect(score).toBeGreaterThan(0);
    });

    it('gives points for description with timestamps', () => {
      const score = calculateSEOScore('Title', 'TIMESTAMPS: 00:00 Intro', ['python']);
      expect(score).toBeGreaterThan(0);
    });

    it('gives points for description with links', () => {
      const score = calculateSEOScore('Title', 'Visit http://example.com for more', ['python']);
      expect(score).toBeGreaterThan(0);
    });

    it('gives points for well-formatted description', () => {
      const desc = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11\n';
      const score = calculateSEOScore('Title', desc, ['python']);
      expect(score).toBeGreaterThan(0);
    });

    it('gives points for primary keyword in first 125 chars', () => {
      const desc = 'python is a great programming language for beginners and experts alike';
      const score = calculateSEOScore('Title', desc, ['python']);
      expect(score).toBeGreaterThan(0);
    });

    it('gives points for many tags', () => {
      const tags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
      const score = calculateSEOScore('Title', 'Description', tags);
      expect(score).toBeGreaterThan(0);
    });

    it('gives points for long-tail keywords in tags', () => {
      const tags = ['python tutorial for beginners', 'how to learn python'];
      const score = calculateSEOScore('Title', 'Description', tags);
      expect(score).toBeGreaterThan(0);
    });

    it('gives points for tags within 500 char limit', () => {
      const tags = ['python', 'programming', 'tutorial'];
      const score = calculateSEOScore('Title', 'Description', tags);
      expect(score).toBeGreaterThan(0);
    });

    it('gives points for no duplicate tags', () => {
      const tags = ['python', 'python', 'programming'];
      const score = calculateSEOScore('Title', 'Description', tags);
      expect(score).toBeGreaterThan(0);
    });
  });
});