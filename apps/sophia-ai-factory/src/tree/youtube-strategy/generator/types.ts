export interface StrategyRequest {
  readonly topic?: string;
  readonly targetAudience?: string;
  readonly trendingTopics?: readonly string[];
}

export interface ContentStrategy {
  readonly topic: string;
  readonly angle: string;
  readonly targetAudience: string;
  readonly contentType: string;
  readonly keywords: readonly string[];
  readonly estimatedViews: number;
  readonly bestPublishTime: string;
  readonly competitorAnalysis: readonly CompetitorInsight[];
  readonly createdAt: string;
}

export interface CompetitorInsight {
  readonly channelId: string;
  readonly averageViews: number;
  readonly relevantTopics: readonly string[];
}

export interface AIGenerateFn {
  (prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string>;
}
