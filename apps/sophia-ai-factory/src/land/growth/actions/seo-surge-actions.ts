/**
 * @file seo-surge-actions.ts
 * @description Server Actions for Search-Surge SEO Jacker
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  detectSearchSurge,
  generateSeoMetadata,
} from '@/tree/seo/search-surge-engine';
import type { SearchVelocityPoint } from '@/seed/types/growth-triad-v6-types';

export async function detectAndJackSeoSurgeAction(params: {
  keyword: string;
  history: SearchVelocityPoint[];
  currentVelocity: number;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const analysis = detectSearchSurge(
    params.keyword,
    params.history,
    params.currentVelocity
  );
  const metadata = generateSeoMetadata(params.keyword, analysis.intent);

  const db = createServerClient();
  const now = Date.now();
  const recordId = `surge_${now}_${Math.random().toString(36).substring(2, 7)}`;

  await db
    .prepare(
      `INSERT INTO seo_surge_records (
         id, keyword, current_velocity, mean_velocity, std_dev,
         z_score, is_surging, intent, generated_title, generated_tags,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      recordId,
      params.keyword,
      params.currentVelocity,
      analysis.meanVelocity,
      analysis.stdDev,
      analysis.zScore,
      analysis.isSurging ? 1 : 0,
      analysis.intent,
      metadata.title,
      JSON.stringify(metadata.tags),
      now,
      now
    )
    .run();

  if (analysis.isSurging) {
    await inngest.send({
      name: 'seo.surge.detected',
      data: {
        keyword: params.keyword,
        zScore: analysis.zScore,
        currentVelocity: params.currentVelocity,
        intent: analysis.intent,
        generatedTitle: metadata.title,
      },
    });
  }

  return {
    success: true as const,
    recordId,
    analysis,
    metadata,
  };
}
