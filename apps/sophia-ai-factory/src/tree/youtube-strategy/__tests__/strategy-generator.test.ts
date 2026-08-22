import { describe, it, expect, vi } from 'vitest';
import {
  generateStrategy,
  parseAIStrategyResponse,
  extractKeywordsFromTopic,
  selectContentType,
  normalizeContentType,
  selectOptimalTopic,
  generateAngle,
  predictViews,
  calculateBestPublishTime,
  type StrategyRequest,
} from '../strategy-generator';

describe('strategy-generator', () => {
  describe('extractKeywordsFromTopic', () => {
    it('extracts meaningful keywords', () => {
      const result = extractKeywordsFromTopic('Python Programming Tutorial');
      expect(result).toContain('python');
      expect(result).toContain('programming');
      expect(result).toContain('tutorial');
    });

    it('filters stop words', () => {
      const result = extractKeywordsFromTopic('The Best Way to Learn Python');
      expect(result).not.toContain('the');
      expect(result).not.toContain('to');
      expect(result).toContain('best');
      expect(result).toContain('learn');
      expect(result).toContain('python');
    });
  });

  describe('selectContentType', () => {
    it('selects Tutorial for "how to" topics', () => {
      expect(selectContentType('how to bake bread')).toBe('Tutorial');
    });

    it('selects List for "top" topics', () => {
      expect(selectContentType('top 10 python tips')).toBe('List');
    });

    it('selects Review for "review" topics', () => {
      expect(selectContentType('iphone review comparison')).toBe('Review');
    });

    it('falls back to Explainer', () => {
      expect(selectContentType('python programming language')).toBe('Explainer');
    });
  });

  describe('normalizeContentType', () => {
    it('normalizes to allowed content types', () => {
      expect(normalizeContentType('tutorial', 'python')).toBe('Tutorial');
      expect(normalizeContentType('TUTORIAL', 'python')).toBe('Tutorial');
    });

    it('falls back to selectContentType for unknown types', () => {
      expect(normalizeContentType('invalid', 'how to python')).toBe('Tutorial');
    });

    it('handles empty string', () => {
      expect(normalizeContentType('', 'python')).toBe('Explainer');
    });
  });

  describe('selectOptimalTopic', () => {
    it('prefers readable multi-word topics', () => {
      const topics = [
        { topic: 'python', finalScore: 10 },
        { topic: 'python programming tutorial', finalScore: 8 },
      ];
      const result = selectOptimalTopic(topics);
      expect(result.topic).toBe('python programming tutorial');
    });

    it('falls back to evergreen when no readable topic', () => {
      const topics = [{ topic: 'abc', finalScore: 10 }];
      const result = selectOptimalTopic(topics);
      expect(result.topic).toContain(' ');
      expect(result.topic.length).toBeGreaterThan(8);
    });
  });

  describe('generateAngle', () => {
    it('returns a non-empty angle string', () => {
      const angle = generateAngle('Python Programming');
      expect(angle.length).toBeGreaterThan(0);
      expect(typeof angle).toBe('string');
    });

    it('includes the topic in the angle', () => {
      const angle = generateAngle('Python Programming');
      expect(angle.toLowerCase()).toContain('python');
    });
  });

  describe('predictViews', () => {
    it('returns a positive number', () => {
      const views = predictViews('Python Programming');
      expect(views).toBeGreaterThan(0);
      expect(Number.isInteger(views)).toBe(true);
    });
  });

  describe('calculateBestPublishTime', () => {
    it('returns a valid ISO timestamp', () => {
      const time = calculateBestPublishTime();
      const date = new Date(time);
      expect(Number.isNaN(date.getTime())).toBe(false);
      expect(time).toContain('T');
    });
  });

  describe('parseAIStrategyResponse', () => {
    it('parses valid JSON strategy response', () => {
      const response = JSON.stringify({
        topic: 'Python Programming',
        angle: 'The Ultimate Guide',
        targetAudience: 'Developers',
        contentType: 'Tutorial',
        keywords: ['python', 'programming'],
      });
      const result = parseAIStrategyResponse(response);
      expect(result).not.toBeNull();
      expect(result!.topic).toBe('Python Programming');
      expect(result!.contentType).toBe('Tutorial');
      expect(result!.keywords).toEqual(['python', 'programming']);
    });

    it('returns null for response missing topic', () => {
      const response = JSON.stringify({ angle: 'Test' });
      const result = parseAIStrategyResponse(response);
      expect(result).toBeNull();
    });

    it('handles markdown code fences', () => {
      const response = '```json\n' + JSON.stringify({
        topic: 'Python',
        angle: 'Test',
        targetAudience: 'Dev',
        contentType: 'Explainer',
        keywords: ['python'],
      }) + '\n```';
      const result = parseAIStrategyResponse(response);
      expect(result).not.toBeNull();
      expect(result!.topic).toBe('Python');
    });

    it('normalizes unknown content type', () => {
      const response = JSON.stringify({
        topic: 'Python',
        contentType: 'invalid',
        keywords: ['python'],
      });
      const result = parseAIStrategyResponse(response);
      expect(result!.contentType).toBe('Explainer');
    });

    it('extracts keywords from topic when AI keywords missing', () => {
      const response = JSON.stringify({
        topic: 'Python Programming Tutorial',
        keywords: [],
      });
      const result = parseAIStrategyResponse(response);
      expect(result!.keywords).toContain('python');
    });
  });

  describe('generateStrategy', () => {
    it('generates template strategy when no AI available', async () => {
      const request: StrategyRequest = { topic: 'Python Programming' };
      const result = await generateStrategy(request);
      expect(result.topic).toBe('Python Programming');
      expect(result.angle.length).toBeGreaterThan(0);
      expect(result.targetAudience.length).toBeGreaterThan(0);
      expect(result.createdAt).toContain('T');
    });

    it('uses AI generation when available', async () => {
      const mockGenerate = vi.fn().mockResolvedValue(JSON.stringify({
        topic: 'AI Strategies',
        angle: 'The Future',
        targetAudience: 'Tech Enthusiasts',
        contentType: 'Explainer',
        keywords: ['ai', 'strategies'],
      }));
      const result = await generateStrategy({ topic: 'AI' }, mockGenerate);
      expect(mockGenerate).toHaveBeenCalled();
      expect(result.topic).toBe('AI Strategies');
      expect(result.targetAudience).toBe('Tech Enthusiasts');
    });

    it('falls back to template when AI fails', async () => {
      const mockGenerate = vi.fn().mockRejectedValue(new Error('API error'));
      const result = await generateStrategy({ topic: 'Python' }, mockGenerate);
      expect(result.topic).toBe('Python');
    });

    it('falls back to template when AI returns invalid JSON', async () => {
      const mockGenerate = vi.fn().mockResolvedValue('not valid json');
      const result = await generateStrategy({ topic: 'Python' }, mockGenerate);
      expect(result.topic).toBe('Python');
    });
  });
});