import {
  generateScript,
  parseAIScriptResponse,
  estimateDuration,
  formatDuration,
  type ScriptStrategy,
} from '../script-writer';

describe('script-writer', () => {
  const strategy: ScriptStrategy = {
    topic: 'Python Programming',
    angle: 'The Ultimate Guide',
    contentType: 'Tutorial',
    targetAudience: 'Beginners',
    keywords: ['python', 'programming', 'tutorial'],
  };

  describe('generateScript', () => {
    it('generates a complete script', () => {
      const script = generateScript(strategy);
      expect(script.title).toContain('Python');
      expect(script.hook.text).toBeDefined();
      expect(script.introduction.greeting).toBeDefined();
      expect(script.mainContent.sections.length).toBeGreaterThan(0);
      expect(script.conclusion.finalThought).toBeDefined();
      expect(script.callToAction.subscribe).toBeDefined();
      expect(script.fullScript).toContain('TITLE:');
    });

    it('sets tone and pacing from template', () => {
      const script = generateScript(strategy);
      expect(script.tone).toBe('educational');
      expect(script.pacing).toBe('moderate');
    });

    it('includes keywords in script', () => {
      const script = generateScript(strategy);
      expect(script.keywords).toEqual(strategy.keywords);
    });

    it('formats full script with sections', () => {
      const script = generateScript(strategy);
      expect(script.fullScript).toContain('HOOK');
      expect(script.fullScript).toContain('INTRODUCTION');
      expect(script.fullScript).toContain('MAIN CONTENT');
      expect(script.fullScript).toContain('CONCLUSION');
      expect(script.fullScript).toContain('CALL TO ACTION');
    });

    it('includes estimated duration', () => {
      const script = generateScript(strategy);
      expect(script.duration).toMatch(/^\d+:\d{2}$/);
    });
  });

  describe('parseAIScriptResponse', () => {
    it('parses valid AI script response', () => {
      const response = JSON.stringify({
        title: 'Python Tutorial',
        hook: 'Have you ever wanted to learn Python?',
        sections: [
          { title: 'Setup', content: ['Install Python'], duration: 60 },
        ],
        cta: 'Subscribe for more!',
        claims: [],
      });
      const result = parseAIScriptResponse(response, strategy);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Python Tutorial');
      expect(result!.hook.text).toContain('Python');
      expect(result!.sections).toHaveLength(1);
    });

    it('returns null for response missing required fields', () => {
      const response = JSON.stringify({ title: 'Test' });
      const result = parseAIScriptResponse(response, strategy);
      expect(result).toBeNull();
    });

    it('handles markdown code fences', () => {
      const response = '```json\n' + JSON.stringify({
        title: 'Test',
        hook: 'Hook text',
        sections: [{ title: 'Sec', content: ['line'], duration: 30 }],
        cta: 'CTA',
      }) + '\n```';
      const result = parseAIScriptResponse(response, strategy);
      expect(result).not.toBeNull();
    });

    it('handles hook as object', () => {
      const response = JSON.stringify({
        title: 'Test',
        hook: { text: 'Hook text object' },
        sections: [{ title: 'Sec', content: ['line'], duration: 30 }],
        cta: 'CTA',
      });
      const result = parseAIScriptResponse(response, strategy);
      expect(result!.hook.text).toBe('Hook text object');
    });

    it('normalizes AI claims against allowed sources', () => {
      const response = JSON.stringify({
        title: 'Test',
        hook: 'Hook',
        sections: [{ title: 'Sec', content: ['line'], duration: 30 }],
        cta: 'CTA',
        claims: [{
          text: 'Python is popular',
          riskLevel: 'standard',
          sourceUrls: ['https://example.com/valid'],
        }],
      });
      const strategyWithSources: ScriptStrategy = {
        ...strategy,
        researchSources: [{ url: 'https://example.com/valid' }],
      };
      const result = parseAIScriptResponse(response, strategyWithSources);
      expect(result!.claims).toHaveLength(1);
      expect(result!.claims[0].sourceUrls).toEqual(['https://example.com/valid']);
    });
  });

  describe('estimateDuration', () => {
    it('estimates duration from sections', () => {
      const mainContent = {
        sections: [
          { type: 'intro', title: 'Intro', content: ['line'], duration: 60 },
          { type: 'body', title: 'Body', content: ['line'], duration: 120 },
        ],
        totalDuration: 180,
      };
      const duration = estimateDuration(mainContent);
      expect(duration).toMatch(/^\d+:\d{2}$/);
    });
  });

  describe('formatDuration', () => {
    it('formats seconds as M:SS', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(120)).toBe('2:00');
    });

    it('handles edge cases', () => {
      expect(formatDuration(59)).toBe('0:59');
      expect(formatDuration(3661)).toBe('61:01');
    });
  });
});