import type { StrategyRequest, ContentStrategy, AIGenerateFn } from './types';
import { EVERGREEN_FALLBACK_TOPICS } from './constants';
import {
  extractKeywordsFromTopic,
  selectContentType,
  normalizeContentType,
  generateAngle,
  predictViews,
  calculateBestPublishTime,
} from './heuristics';

export function parseJsonResponse(response: string): Record<string, unknown> {
  const text = String(response ?? '').trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    return JSON.parse(match[0]);
  }
}

/**
 * Parse an AI strategy response from JSON text.
 */
export function parseAIStrategyResponse(response: string): ContentStrategy | null {
  try {
    const parsed = parseJsonResponse(response);
    const topic = String(parsed.topic ?? '').trim();
    if (!topic) return null;

    const contentType = normalizeContentType(parsed.contentType, topic);
    const keywords = Array.isArray(parsed.keywords) && parsed.keywords.length > 0
      ? parsed.keywords.map((kw: unknown) => String(kw).trim()).filter(Boolean)
      : extractKeywordsFromTopic(topic);

    return {
      topic,
      angle: String(parsed.angle ?? generateAngle(topic)).trim(),
      targetAudience: String(parsed.targetAudience ?? 'General audience').trim(),
      contentType,
      keywords,
      estimatedViews: predictViews(topic),
      bestPublishTime: calculateBestPublishTime(),
      competitorAnalysis: [],
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function generateStrategyWithAI(
  request: StrategyRequest,
  generateText: AIGenerateFn,
): Promise<ContentStrategy | null> {
  const trending = (request.trendingTopics ?? []).slice(0, 10).join(', ');
  const prompt = `You are selecting a YouTube content strategy.
Return only valid JSON with this exact shape:
{
  "topic": "specific video topic",
  "angle": "distinct content angle",
  "targetAudience": "specific audience",
  "contentType": "Tutorial|Explainer|List|Review|Story|News",
  "keywords": ["keyword"]
}

Requested topic: ${request.topic ?? 'none'}
Trending topics: ${trending || 'Technology Trends'}
Target audience: ${request.targetAudience ?? 'General audience interested in educational content'}`;

  const response = await generateText(prompt, { maxTokens: 1000, temperature: 0.7 });
  return parseAIStrategyResponse(response);
}

export function generateTemplateStrategy(request: StrategyRequest): ContentStrategy {
  const topic = request.topic ?? EVERGREEN_FALLBACK_TOPICS[Math.floor(Math.random() * EVERGREEN_FALLBACK_TOPICS.length)];
  return {
    topic,
    angle: generateAngle(topic),
    targetAudience: request.targetAudience ?? 'General audience interested in educational content',
    contentType: selectContentType(topic),
    keywords: extractKeywordsFromTopic(topic),
    estimatedViews: predictViews(topic),
    bestPublishTime: calculateBestPublishTime(),
    competitorAnalysis: [],
    createdAt: new Date().toISOString(),
  };
}
