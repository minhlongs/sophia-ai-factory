/**
 * AI-powered content strategy generation with fallback templates.
 * Uses Sophia's LLM router for AI generation, falls back to template mode.
 * Ported from Lumen's content-strategy-agent.
 */

import { logger } from '@/seed/utils/logger-utility';

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

const CONTENT_TYPES = [
  { type: 'Tutorial', suitableFor: ['how to', 'guide', 'learn'] },
  { type: 'List', suitableFor: ['best', 'top', 'worst'] },
  { type: 'Review', suitableFor: ['review', 'vs', 'comparison'] },
  { type: 'Explainer', suitableFor: ['what is', 'why', 'explained'] },
  { type: 'Story', suitableFor: ['story', 'journey', 'experience'] },
] as const;

const ALLOWED_CONTENT_TYPES = new Set(['Tutorial', 'Explainer', 'List', 'Review', 'Story', 'News']);

const EVERGREEN_FALLBACK_TOPICS = [
  'Time Management Strategies That Actually Work',
  'Beginner Mistakes to Avoid When Learning a New Skill',
  'How to Start a Side Project With Zero Budget',
  'Simple Habits That Improve Focus and Productivity',
  'How to Learn Anything Faster Using Proven Study Techniques',
] as const;

const BEST_TIMES = [
  { day: 'Tuesday', hour: 14 },
  { day: 'Wednesday', hour: 14 },
  { day: 'Thursday', hour: 14 },
  { day: 'Friday', hour: 15 },
  { day: 'Saturday', hour: 10 },
  { day: 'Sunday', hour: 10 },
] as const;

/**
 * Generate a content strategy, preferring AI generation when available.
 */
export async function generateStrategy(
  request: StrategyRequest,
  generateText?: AIGenerateFn,
): Promise<ContentStrategy> {
  if (generateText) {
    try {
      const aiStrategy = await generateStrategyWithAI(request, generateText);
      if (aiStrategy) return aiStrategy;
    } catch (err) {
      logger.warn('AI strategy generation failed; using template fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return generateTemplateStrategy(request);
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

/**
 * Extract keywords from a topic string.
 */
export function extractKeywordsFromTopic(topic: string): string[] {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was',
    'were', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'just', 'now',
  ]);
  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
}

/**
 * Select content type based on topic keywords.
 */
export function selectContentType(topic: string): string {
  const topicLower = topic.toLowerCase();
  for (const ct of CONTENT_TYPES) {
    if (ct.suitableFor.some((kw) => topicLower.includes(kw))) return ct.type;
  }
  return 'Explainer';
}

/**
 * Normalize a content type string to the allowed set.
 */
export function normalizeContentType(contentType: unknown, topic: string): string {
  const normalized = String(contentType ?? '').trim();
  const titleCased = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return ALLOWED_CONTENT_TYPES.has(titleCased as 'Tutorial' | 'Explainer' | 'List' | 'Review' | 'Story' | 'News')
    ? titleCased
    : selectContentType(topic);
}

/**
 * Select the best trending topic by score, filtering out single keywords.
 */
export function selectOptimalTopic(
  topics: ReadonlyArray<{ readonly topic: string; readonly finalScore: number }>,
): { topic: string; score: number } {
  const readable = topics.find((t) => t.topic.trim().includes(' ') && t.topic.trim().length >= 8);
  if (readable) return { topic: readable.topic, score: readable.finalScore };
  const fallback = EVERGREEN_FALLBACK_TOPICS[Math.floor(Math.random() * EVERGREEN_FALLBACK_TOPICS.length)];
  return { topic: fallback, score: 1 };
}

export function generateAngle(topic: string): string {
  const angles = [
    `The Ultimate Guide to ${topic}`,
    `${topic}: What Nobody Is Telling You`,
    `How ${topic} Will Change Everything in ${new Date().getFullYear()}`,
    `${topic} Explained in 5 Minutes`,
  ];
  return angles[Math.floor(Math.random() * angles.length)];
}

export function predictViews(_topic: string): number {
  const base = 5000;
  const variance = base * 0.3;
  return Math.floor(base + Math.random() * variance * 2 - variance);
}

export function calculateBestPublishTime(): string {
  const selected = BEST_TIMES[Math.floor(Math.random() * BEST_TIMES.length)];
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = days.indexOf(selected.day);
  const currentDay = now.getDay();
  const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(selected.hour, 0, 0, 0);
  return next.toISOString();
}

async function generateStrategyWithAI(
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

function generateTemplateStrategy(request: StrategyRequest): ContentStrategy {
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

function parseJsonResponse(response: string): Record<string, unknown> {
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
