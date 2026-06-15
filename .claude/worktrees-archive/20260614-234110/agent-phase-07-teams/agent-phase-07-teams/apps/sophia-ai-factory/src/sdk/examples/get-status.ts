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
    // Get specific mission — print results to stderr instead of stdout
    const mission = await sophia.missions.get(missionId);
    console.error(`Mission ${missionId}:`);
    console.error(`  Command: ${mission.command}`);
    console.error(`  Status: ${mission.status}`);
    console.error(`  Credits used: ${mission.credits_used}`);
    if (mission.result) {
      console.error('  Result:', JSON.stringify(mission.result, null, 2));
    }
    if (mission.error) {
      console.error('  Error:', mission.error);
    }
   } else {
    // List recent missions — print results to stderr instead of stdout
    console.error('Recent missions:');
    const { missions } = await sophia.missions.list({ limit: 10 });
    for (const m of missions) {
      console.error(`  [${m.status}] ${m.id} — ${m.command} (${m.credits_used} MCU)`);
    }
   }
}

main().catch(console.error);
