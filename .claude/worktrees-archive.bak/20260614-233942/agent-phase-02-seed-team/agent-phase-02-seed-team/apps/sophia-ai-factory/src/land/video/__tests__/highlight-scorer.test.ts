import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreHighlights } from '../highlight-scorer';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn(),
}));

describe('highlight-scorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when transcript is empty', async () => {
    const res = await scoreHighlights('u1', []);
    expect(res).toEqual([]);
  });

  it('throws error when no API key is resolved', async () => {
    vi.mocked(resolveUserApiKey).mockResolvedValue(null);
    await expect(scoreHighlights('u1', [{ text: 'hello', start: 0, end: 1000 }]))
      .rejects.toThrow('No OpenRouter API key available');
  });

  it('scores highlights and parses multi-dimensional scores and metadata successfully', async () => {
    vi.mocked(resolveUserApiKey).mockResolvedValue('test-key');

    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              clips: [
                {
                  start_ms: 1000,
                  end_ms: 20000,
                  hook_score: 0.9,
                  pacing_score: 0.8,
                  retention_score: 0.85,
                  cta_score: 0.7,
                  title: 'Catchy Hook Title',
                  reasoning: 'Great opening',
                  caption: 'Check this out!',
                  hashtags: ['viral', 'cool'],
                  subtitle_style: 'bold-yellow',
                  tone: 'energetic',
                },
              ],
            }),
          },
        },
      ],
    };

    const globalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    try {
      const res = await scoreHighlights('u1', [
        { text: 'This is the first segment.', start: 0, end: 10000 },
        { text: 'This is the second segment.', start: 10000, end: 25000 },
      ]);

      expect(res).toHaveLength(1);
      const clip = res[0];
      expect(clip.start_ms).toBe(1000);
      expect(clip.end_ms).toBe(20000);
      expect(clip.score).toBe(0.81); // average of 0.9, 0.8, 0.85, 0.7
      expect(clip.hook_score).toBe(0.9);
      expect(clip.pacing_score).toBe(0.8);
      expect(clip.retention_score).toBe(0.85);
      expect(clip.cta_score).toBe(0.7);
      expect(clip.title).toBe('Catchy Hook Title');
      expect(clip.caption).toBe('Check this out!');
      expect(clip.hashtags).toEqual(['viral', 'cool']);
      expect(clip.subtitle_style).toBe('bold-yellow');
      expect(clip.tone).toBe('energetic');
    } finally {
      global.fetch = globalFetch;
    }
  });
});
