/**
 * SDK Example: Check mission status and list recent missions
 */

import { SophiaClient } from '../index';

async function main() {
  const sophia = new SophiaClient({
    apiKey: process.env.SOPHIA_API_KEY ?? '',
    baseUrl: process.env.SOPHIA_BASE_URL ?? 'https://sophia.agencyos.network',
  });

  const missionId = process.argv[2];

  if (missionId) {
    // Get specific mission
    const mission = await sophia.missions.get(missionId);
    console.log(`Mission ${missionId}:`);
    console.log(`  Command: ${mission.command}`);
    console.log(`  Status: ${mission.status}`);
    console.log(`  Credits used: ${mission.credits_used}`);
    if (mission.result) {
      console.log('  Result:', JSON.stringify(mission.result, null, 2));
    }
    if (mission.error) {
      console.log('  Error:', mission.error);
    }
  } else {
    // List recent missions
    console.log('Recent missions:');
    const { missions } = await sophia.missions.list({ limit: 10 });
    for (const m of missions) {
      console.log(`  [${m.status}] ${m.id} — ${m.command} (${m.credits_used} MCU)`);
    }
  }
}

main().catch(console.error);
