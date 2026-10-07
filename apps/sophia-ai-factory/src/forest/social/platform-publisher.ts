/**
 * Social Platform Publisher
 *
 * Infrastructure to handle actual video publication events.
 *
 * Layer: forest/social (Infrastructure Orchestrator)
 * @module forest/social/platform-publisher
 */

import { inngest } from '@/seed/inngest/client';
import { getSafeKey } from '@/tree/credentials/vault';
import { PROVIDER_REGISTRY } from '@/seed/config/providers/registry';


export const publishVideoJob = inngest.createFunction(
  { id: 'publish-video-job', name: 'Publish Video to Socials' },
  { event: 'publish.scheduled' },
  async ({ event, step }) => {
    const { jobId, tenantId } = event.data;
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://automation.example.com';

    // Orchestrate with external automation (n8n / make.com hook)
    // to strictly adhere to the no-tech doctrine (customer-owned automation)
    await step.run('trigger-platform-automation', async () => {
      // Use the safe key provider vault for webhook authentication
      const apiKey = await getSafeKey(tenantId || 'sophia-global', PROVIDER_REGISTRY.N8N_SYNDICATOR);

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          jobId,
          tenantId,
          publishedAt: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger social automaton: ${response.statusText}`);
      }
      return response.json();
    });

    return { status: 'published', jobId };
  }
);
