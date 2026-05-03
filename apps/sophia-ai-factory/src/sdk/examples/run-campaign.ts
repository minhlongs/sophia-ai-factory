/**
 * SDK Example: Run a full lead + email campaign pipeline
 */

import { SophiaClient } from '../index';

async function main() {
  const sophia = new SophiaClient({
    apiKey: process.env.SOPHIA_API_KEY ?? '',
    baseUrl: process.env.SOPHIA_BASE_URL ?? 'https://sophia.agencyos.network',
  });

  // Check credits first
  const balance = await sophia.credits.getBalance();
  console.log(`MCU Balance: ${balance.credits_remaining} credits remaining`);

  if (balance.credits_remaining < 5) {
    console.error('Insufficient credits. Visit https://sophia.agencyos.network/dashboard/credits to top up.');
    process.exit(1);
  }

  // Run campaign pipeline (lead:find → email:campaign)
  console.log('\nLaunching campaign pipeline...');
  const mission = await sophia.missions.create({
    command: 'campaign:run',
    params: {
      niche: 'SaaS startups',
      lead_count: 20,
      subject: 'Exclusive offer for SaaS teams',
      body: '<h1>Grow faster with AI</h1><p>Sophia AI Factory automates your content creation pipeline.</p>',
    },
    webhook_url: process.env.WEBHOOK_URL,
  });

  console.log(`Campaign mission: ${mission.id}`);

  // Poll with SSE stream
  for await (const event of sophia.missions.stream(mission.id)) {
    if (event.event === 'status') {
      console.log(`  Status: ${(event.data as { status: string }).status}`);
    }
    if (event.event === 'done') break;
  }

  const final = await sophia.missions.get(mission.id);
  console.log('\nCampaign complete:', final.result);
}

main().catch(console.error);
