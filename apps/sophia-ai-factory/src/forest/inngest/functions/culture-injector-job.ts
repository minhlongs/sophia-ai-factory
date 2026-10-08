/**
 * @file score-cultural-alignment.job.ts
 * @description Inngest background job for Growth Triad v9: Culture Injector
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { NonRetriableError } from 'inngest';
import { createServerClient } from '@/seed/db/client';
import { calculateCulturalAlignmentIndex, CulturalDictionary } from '@/tree/growth-v9/cultural-alignment.engine';

export const cultureInjectorJob = inngest.createFunction(
  {
    id: 'growth-v9-score-cultural-alignment',
    name: 'Growth Triad v9 - Culture Injector Scorer',
    retries: 3,
  },
  { event: 'semantic.culture.scored' },
  async ({ event, step }) => {
    const { scriptId, regionalTarget, transcriptString } = event.data;

    if (!scriptId || !regionalTarget) {
      throw new NonRetriableError('Missing critical fields');
    }

    // Step 1: Provide dictionary based on region mapping
    const dictionary = await step.run('load-cultural-dictionary', async () => {
      const dicts: Record<string, CulturalDictionary> = {
        SOUTHEAST_ASIA: { region: 'SEA', keywords: ['viral', 'deal', 'hot'], idioms: ['flash sale', 'chốt đơn'] },
        NORTH_AMERICA: { region: 'NA', keywords: ['awesome', 'guaranteed'], idioms: ['money back', 'game changer'] },
      };
      return dicts[regionalTarget] || { region: 'UNKNOWN', keywords: [], idioms: [] };
    });

    // Step 2: Math Engine
    const cultureScore = await step.run('calculate-alignment-index', () => {
      return calculateCulturalAlignmentIndex(transcriptString, dictionary);
    });

    // Step 3: Record
    await step.run('persist-culture-score', async () => {
      const db = createServerClient();
      const insertQuery = `
        INSERT INTO growth_v9_culture_scores (script_id, region, alignment_score, recorded_at)
        VALUES (?, ?, ?, datetime('now'))
      `;
      try {
        const stmt = db.prepare(insertQuery).bind(
          scriptId,
          dictionary.region,
          cultureScore.alignmentScore
        );
        await stmt.run();
      } catch (e) {
        // mock swallow
      }
    });

    return {
      status: 'completed',
      scriptId,
      score: cultureScore.alignmentScore
    };
  }
);
