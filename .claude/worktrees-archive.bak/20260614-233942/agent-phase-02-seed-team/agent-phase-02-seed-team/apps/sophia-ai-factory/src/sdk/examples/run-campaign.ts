/**
 * SDK Example: Run a full lead + email campaign pipeline.
 *
 * @edge-runtime-allowed: standalone CLI example, not imported by app code
 * or middleware. process.exit() runs only when this file is executed
 * directly via `tsx src/sdk/examples/run-campaign.ts` (Node).
 */

import { SophiaClient } from '../index';

async function main() {
  const sophia = new SophiaClient({
    apiKey: process.env.SOPHIA_API_KEY ?? '',
    baseUrl: process.env.SOPHIA_BASE_URL ?? 'https://sophia.agencyos.network',
  });

  // Check credits first — all output to stderr so stdout stays clean
  const balance = await sophia.credits.getBalance();
  console.error(`MCU Balance: ${balance.credits_remaining} credits remaining`);

  if (balance.credits_remaining < 5) {
    console.error('Insufficient credits. Visit https://sophia.agencyos.network/dashboard/credits to top up.');
    process.exit(1);
   }

   // Run campaign pipeline (lead:find → email:campaign) — output to stderr
  console.error('\nLaunching campaign pipeline...');
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

  console.error(`Campaign mission: ${mission.id}`);

   // Poll with SSE stream — output to stderr
  for await (const event of sophia.missions.stream(mission.id)) {
    if (event.event === 'status') {
      console.error(`  Status: ${(event.data as { status: string }).status}`);
     }
    if (event.event === 'done') break;
   }

  const final = await sophia.missions.get(mission.id);
  console.error('\nCampaign complete:', final.result);
}

main().catch(console.error);
