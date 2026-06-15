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

  // Create video mission — output to stderr so stdout stays clean for piping
  console.error('Creating video mission...');
  const mission = await sophia.missions.create({
   command: 'video:create',
   params: {
     title: 'My AI Avatar Video',
     script: 'Hello! Welcome to Sophia AI Factory. We help agencies automate their content creation.',
    },
  });

  console.error(`Mission created: ${mission.id} (status: ${mission.status})`);
  console.error(`Credits required: ${mission.credits_required}`);

  // Stream status updates — output to stderr
  console.error('\nStreaming status updates...');
  for await (const event of sophia.missions.stream(mission.id)) {
   console.error(`[${event.event}]`, JSON.stringify(event.data, null, 2));
   if (event.event === 'done') break;
  }

  // Final state — output to stderr
  const final = await sophia.missions.get(mission.id);
  console.error('\nFinal state:', final.status);
  if (final.result) {
   console.error('Result:', JSON.stringify(final.result, null, 2));
  }
}

main().catch(console.error);
