/**
 * Syndication Orchestrator
 *
 * Coordinates platform publishing using Inngest to guarantee delivery
 * across scheduled staggered cadences.
 *
 * Layer: forest/social/syndication-manager
 */

import { inngest } from '@/seed/inngest/client';
import { calculatePublishingDelay } from '@/tree/social/syndication/syndication-pacer';

export const scheduleSyndicationJob = inngest.createFunction(
  { id: 'schedule-syndication', name: 'Schedule Syndication' },
  { event: 'niche.video.campaign.requested' },
  async ({ event, step }) => {
    const { productName, productUrl, userId } = event.data;
    const platforms: ('tiktok' | 'x' | 'youtube')[] = ['tiktok', 'x', 'youtube'];

    // Schedule each platform with anti-spam pacer delay
    for (const [index, platform] of platforms.entries()) {
      const delay = calculatePublishingDelay(platform, index);

      await step.sleep(`delay-${platform}`, `${delay}ms`);

      await step.sendEvent(`trigger-publish-${platform}`, {
        name: 'publish.scheduled',
        data: {
          jobId: `syndicate_${platform}_${Date.now()}`,
          tenantId: 'sophia-global',
          userId: userId || 'system',
        },
      });
    }

    return { status: 'scheduled', productName, productUrl };
  }
);
