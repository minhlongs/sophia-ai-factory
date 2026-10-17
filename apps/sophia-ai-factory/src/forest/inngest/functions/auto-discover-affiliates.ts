/**
 * Inngest cron function: Auto-Discover Affiliates
 *
 * Runs daily at 8 AM UTC. Scans affiliate programs, scores them
 * against configured niches, stores high-scoring results in Supabase,
 * and sends a Telegram notification summary.
 */

import { inngest } from '@/seed/inngest/client';
import { getAllPrograms, getCategories } from '@/land/affiliates';
import { sendMessage as sendTelegramMessage } from '@/tree/telegram/handlers/utils';
import {
  DEFAULT_NICHES,
  scoreProgramsAcrossNiches,
  storeDiscoveredAffiliates,
  buildDiscoveryReportMessage,
  type ScoredAffiliateWithNiche,
} from './auto-discover-affiliates-helpers';

export {
  DEFAULT_NICHES,
  scoreProgramsAcrossNiches,
  storeDiscoveredAffiliates,
  buildDiscoveryReportMessage,
  type ScoredAffiliateWithNiche,
};

export const autoDiscoverAffiliates = inngest.createFunction(
  {
    id: 'auto-discover-affiliates',
    name: 'Auto-Discover Affiliates',
  },
  { cron: '0 8 * * *' },
  async ({ step }) => {
    // Step 1: Fetch affiliate categories and programs
    const programs = await step.run('fetch-programs', async () => {
      const allPrograms = getAllPrograms();
      const categories = getCategories();
      return { programs: allPrograms, categories };
    });

    // Step 2: Score programs across all niches
    const scoredResults = await step.run('score-affiliates', async () => {
      return scoreProgramsAcrossNiches(programs.programs, DEFAULT_NICHES);
    });

    // Step 3: Store high-score results in Supabase
    const stored = await step.run('store-results', async () => {
      return storeDiscoveredAffiliates(programs.programs, scoredResults);
    });

    // Step 4: Send Telegram notification to admin
    await step.run('notify-discovery-results', async () => {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (!adminChatId) {
        return { notified: false, reason: 'No admin chat ID configured' };
      }

      const message = buildDiscoveryReportMessage(
        scoredResults,
        stored,
        programs.categories.length,
      );

      await sendTelegramMessage(adminChatId, message);
      return { notified: true };
    });

    return {
      discovered: stored.count,
      newDiscoveries: stored.newCount,
      nichesScanned: DEFAULT_NICHES.length,
      categoriesAvailable: programs.categories.length,
    };
  },
);
