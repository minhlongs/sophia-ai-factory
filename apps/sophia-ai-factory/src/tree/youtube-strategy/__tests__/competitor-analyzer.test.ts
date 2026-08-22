import { analyzeVideoPerformance, getCompetitorInsights, type VideoSnippet, type CompetitorChannel, type TopicPerformance } from '../competitor-analyzer';
import { type TrendEvidence } from '../trend-scorer';

describe('competitor-analyzer', () => {
  const evidence: TrendEvidence = {
    url: 'https://youtube.com/watch?v=test',
    title: 'Test Video',
    publisher: 'TestChannel',
    publishedAt: '2024-01-01',
    sourceType: 'video',
  };

  describe('analyzeVideoPerformance', () => {
    it('returns empty for no videos', () => {
      const result = analyzeVideoPerformance([]);
      expect(result.topTopics).toEqual([]);
      expect(result.avgViews).toBe(0);
      expect(result.frequency).toBe(0);
    });

    it('extracts top topics from video titles', () => {
      const videos: VideoSnippet[] = [
        {
          id: 'v1',
          snippet: { title: 'Python Tutorial for Beginners' },
          statistics: { viewCount: 1000 },
        },
        {
          id: 'v2',
          snippet: { title: 'Python Programming Course' },
          statistics: { viewCount: 2000 },
        },
      ];
      const result = analyzeVideoPerformance(videos);
      expect(result.topTopics.some((t) => t.topic === 'python')).toBe(true);
      expect(result.avgViews).toBe(1500);
      expect(result.frequency).toBe(2);
    });

    it('builds evidence with URLs', () => {
      const videos: VideoSnippet[] = [
        {
          id: 'v1',
          snippet: { title: 'Python Tutorial' },
          statistics: { viewCount: 1000 },
        },
      ];
      const result = analyzeVideoPerformance(videos);
      const pythonTopic = result.topTopics.find((t) => t.topic === 'python');
      expect(pythonTopic).toBeDefined();
      expect(pythonTopic!.evidence[0].url).toContain('v1');
    });
  });

  describe('getCompetitorInsights', () => {
    it('filters competitors by topic relevance', () => {
      const competitors: CompetitorChannel[] = [
        {
          channelId: 'ch1',
          topPerformingTopics: [{
            topic: 'python',
            avgViews: 1000,
            evidence: [evidence],
          }],
          averageViews: 1000,
          uploadFrequency: 5,
        },
        {
          channelId: 'ch2',
          topPerformingTopics: [{
            topic: 'java',
            avgViews: 2000,
            evidence: [evidence],
          }],
          averageViews: 2000,
          uploadFrequency: 10,
        },
      ];
      const insights = getCompetitorInsights(competitors, 'python');
      expect(insights).toHaveLength(1);
      expect(insights[0].channelId).toBe('ch1');
    });

    it('returns empty for no matches', () => {
      const competitors: CompetitorChannel[] = [{
        channelId: 'ch1',
        topPerformingTopics: [{ topic: 'python', avgViews: 1000, evidence: [evidence] }],
        averageViews: 1000,
        uploadFrequency: 5,
      }];
      const insights = getCompetitorInsights(competitors, 'javascript');
      expect(insights).toHaveLength(0);
    });
  });
});