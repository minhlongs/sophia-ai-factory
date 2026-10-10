import { z } from 'zod';
import { TIER_RANK, type Tier } from '@/seed/types';

export interface ScriptScene {
  id: number;
  type: 'intro' | 'hook' | 'body' | 'cta' | 'outro';
  text: string;
  durationSec: number;
  visualHint: string;
}

export interface GeneratedScript {
  id: string;
  templateId: string;
  templateName: string;
  topic: string;
  brandName: string;
  tone: string;
  language: 'en' | 'vi';
  totalDurationSec: number;
  scenes: ScriptScene[];
  fullScript: string;
  wordCount: number;
  createdAt: string;
}

export interface BuildScriptOptions {
  template: {
    id: string;
    name: string;
    category: string;
    defaults: {
      title: string;
      audience: string;
      tone: string;
      suggestedDuration: number;
    };
  };
  topic: string;
  brandName: string;
  targetDuration: number;
  tone: string;
  language: 'en' | 'vi';
}

export const CATEGORY_MIN_TIER: Record<string, Tier> = {
  welcome: 'BASIC',
  product: 'BASIC',
  seasonal: 'BASIC',
  promotion: 'PREMIUM',
  viral: 'ENTERPRISE',
};

export function tierMeetsMinimum(userTier: Tier, minTier: Tier): boolean {
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[minTier] ?? 0);
}

export const categorySchema = z.enum(['welcome', 'product', 'seasonal', 'promotion', 'viral']);

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(1).max(maxLength).optional(),
  );

export const generateScriptSchema = z.object({
  templateId: z.string().trim().min(1).max(100),
  topic: z.string().trim().min(1).max(500),
  brandName: optionalText(100),
  targetDuration: z.number().int().min(10).max(300).optional().default(30),
  tone: optionalText(80),
  language: z.enum(['en', 'vi']).optional().default('vi'),
});
