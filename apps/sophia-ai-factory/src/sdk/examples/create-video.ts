/**
 * SDK Example: Create a video mission
 *
 * Requirements: Set SOPHIA_API_KEY env var
 */

import { SophiaClient } from '../index';

async function main() {
  const sophia = new SophiaClient({
    apiKey: process.env.SOPHIA_API_KEY ?? '',
    baseUrl: process.env.SOPHIA_BASE_URL ?? 'https://sophia.agencyos.network',
  });

  // Create video mission
  console.log('Creating video mission...');
  const mission = await sophia.missions.create({
    command: 'video:create',
    params: {
      title: 'My AI Avatar Video',
      script: 'Hello! Welcome to Sophia AI Factory. We help agencies automate their content creation.',
    },
  });

  console.log(`Mission created: ${mission.id} (status: ${mission.status})`);
  console.log(`Credits required: ${mission.credits_required}`);

  // Stream status updates
  console.log('\nStreaming status updates...');
  for await (const event of sophia.missions.stream(mission.id)) {
    console.log(`[${event.event}]`, JSON.stringify(event.data, null, 2));
    if (event.event === 'done') break;
  }

  // Final state
  const final = await sophia.missions.get(mission.id);
  console.log('\nFinal state:', final.status);
  if (final.result) {
    console.log('Result:', JSON.stringify(final.result, null, 2));
  }
}

main().catch(console.error);
