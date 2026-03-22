/**
 * @sophia/raas-sdk — Demo: create a proposal mission and poll for completion.
 *
 * Run:
 *   SOPHIA_API_KEY=sk_live_xxx npx ts-node examples/demo.ts
 */

import { SophiaClient, RaasHttpError } from '../src/index.js';

const API_KEY = process.env['SOPHIA_API_KEY'];
if (!API_KEY) {
  console.error('Error: SOPHIA_API_KEY environment variable is required');
  process.exit(1);
}

const client = new SophiaClient({ apiKey: API_KEY });

async function run(): Promise<void> {
  console.log('Creating proposal mission...');

  // 1. Submit mission
  const { mission_id, mcu_cost } = await client.missions.create({
    command: 'proposal:create',
    title: 'Demo: Proposal for Acme Corp',
    params: {
      client: 'Acme Corp',
      budget: 50_000,
      use_case: 'AI video production for marketing campaigns',
    },
    priority: 'normal',
  });

  console.log(`Mission created: ${mission_id} (cost: ${mcu_cost} MCU)`);
  console.log('Polling for result...');

  // 2. Poll until complete
  const result = await client.missions.waitForResult(mission_id, {
    pollIntervalMs: 3_000,
    timeoutMs: 120_000,
  });

  // 3. Print outcome
  if (result.status === 'completed' && result.result?.success) {
    console.log('\nMission completed successfully!');
    console.log('Summary:', result.result.summary ?? '(no summary)');
    if (result.result.output_url) {
      console.log('Output URL:', result.result.output_url);
    }
  } else {
    console.error('\nMission failed:', result.error_message ?? 'unknown error');
    process.exit(1);
  }
}

run().catch((err: unknown) => {
  if (err instanceof RaasHttpError) {
    console.error(`API error ${err.status}:`, err.message);
    if (err.status === 402) console.error('Insufficient MCU balance — top up at agencyos.network');
  } else {
    console.error('Unexpected error:', err);
  }
  process.exit(1);
});
