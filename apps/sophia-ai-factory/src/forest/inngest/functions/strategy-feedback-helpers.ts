/**
 * Strategy Feedback Helpers — prompt builder and confidence validation
 *
 * Layer: forest (infrastructure orchestration)
 */

import type { StrategyRecommendation } from '@/seed/types/performance-feedback';

export const MIN_HIGH_CONFIDENCE_SIGNALS = 5;

export interface CreativeMemorySignalRow {
  key: string;
  value: string;
  category: string;
  evidence: string;
}

export interface ParsedStrategyResponse {
  recommendation?: string;
  reasoning?: string;
  confidence?: string;
  category?: string;
}

export function validateConfidence(raw: string | undefined): 'high' | 'medium' | 'low' {
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'medium';
}

export function buildStrategyPrompt(
  memories: CreativeMemorySignalRow[],
  signalCount: number,
): string {
  const memoryList = memories
    .map((m) => `- [${m.category}] ${m.key}: ${m.value}`)
    .join('\n');

  return `You are a creative strategy advisor for a YouTube content creator.
Based on ${signalCount} high-confidence performance signals, generate ONE actionable strategy recommendation.

High-confidence creative memory signals:
${memoryList}

Respond ONLY with valid JSON in this exact format:
{
  "recommendation": "one clear, actionable strategy change",
  "reasoning": "why this recommendation is supported by the signals",
  "confidence": "high | medium | low",
  "category": "content_type | posting_schedule | audience_targeting | thumbnail | hook | general"
}`;
}

export function buildStrategyRecommendation(
  workspaceId: string,
  signalCount: number,
  memoryRows: CreativeMemorySignalRow[],
  parsed: ParsedStrategyResponse,
): StrategyRecommendation {
  return {
    id: `strat_${Date.now()}_${workspaceId.slice(0, 8)}`,
    workspaceId,
    signalCount,
    signalSummary: memoryRows.slice(0, 5).map((m) => m.key).join(', '),
    recommendation: parsed.recommendation ?? '',
    reasoning: parsed.reasoning ?? '',
    confidence: validateConfidence(parsed.confidence),
    category: parsed.category ?? 'general',
    applied: false,
    createdAt: Date.now(),
  };
}
