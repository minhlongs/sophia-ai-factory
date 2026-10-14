/**
 * Creative Learning Loop Types
 *
 * Layer: tree/learning
 */

import type { CreativeMemory } from '@/seed/types/creative-domain';

export interface LearningInsight {
  category: CreativeMemory['category'];
  key: string;
  value: unknown;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface LearningRecommendation {
  type: 'content' | 'channel' | 'timing' | 'format' | 'budget';
  action: string;
  reasoning: string;
  expectedImpact: string;
}

export interface LearningLoopResult {
  insights: LearningInsight[];
  recommendations: LearningRecommendation[];
  memoriesWritten: number;
}

export type LearningLoopError = { code: 'DB_UNAVAILABLE'; message: string };
