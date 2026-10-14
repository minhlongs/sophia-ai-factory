/**
 * Domain types and NLP hook scoring for autonomous swarm content producer.
 * @module tree/autonomous/swarm-content-scoring
 */

import type { AffiliateOffer } from './swarm-affiliate-scout';

export interface ViralScriptOutput {
  title: string;
  topic: string;
  hook: string;
  hookScore: number; // Quality gate: >= 70
  durationSeconds: number; // Quality gate: 50 to 110s
  wordCount: number; // Quality gate: 100 to 250 words
  language: 'vi' | 'en' | 'bilingual';
  scriptVi: string;
  scriptEn: string;
  voiceoverConfig: {
    provider: 'ElevenLabs';
    voiceId: string;
    voiceName: string;
    gender: 'female';
    stability: number;
  };
  avatarConfig: {
    provider: 'D-ID';
    aspectRatio: '16:9' | '9:16';
    avatarId: string;
    bRollPrompt: string;
  };
  stagingUrl: string; // Cloudflare R2 path
}

export interface ContentProducerInput {
  topic?: string;
  offer?: Partial<AffiliateOffer>;
  language?: 'vi' | 'en' | 'bilingual';
}

export interface ContentProducerOutput {
  videoDraft: ViralScriptOutput;
  stagesCompleted: string[];
  qualityGatesPassed: boolean;
  qualityMetrics: {
    hookScore: number;
    wordCount: number;
    estimatedDurationSeconds: number;
  };
}

/**
 * Calculates a viral hook score (0 to 100) using deterministic NLP pattern analysis.
 */
export function calculateHookScore(hook: string): number {
  if (!hook || hook.trim().length === 0) return 0;
  const text = hook.trim().toLowerCase();
  let score = 50;

  const contrarianKeywords = [
    'bí mật',
    'secret',
    'đừng',
    'stop',
    'sai lầm',
    'mistake',
    'tại sao',
    'why',
    'làm thế nào',
    'how to',
    'sự thật',
    'truth',
  ];
  if (contrarianKeywords.some((k) => text.includes(k))) {
    score += 15;
  }

  const metricKeywords = [
    '1', '2', '3', '4', '5', '7', '10', '30',
    'bước', 'step', 'ngày', 'days', 'triệu', 'k', '$', '%',
  ];
  if (metricKeywords.some((k) => text.includes(k))) {
    score += 15;
  }

  const valueKeywords = [
    'kiếm tiền',
    'doanh thu',
    'tự động',
    'automation',
    'ai',
    'passive income',
    'kinh doanh',
    'mrr',
    'tăng trưởng',
  ];
  if (valueKeywords.some((k) => text.includes(k))) {
    score += 10;
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 6 && words <= 18) {
    score += 10;
  } else if (words < 4 || words > 25) {
    score -= 15;
  }

  return Math.min(100, Math.max(0, score));
}
