/**
 * Script Synthesis Track.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/track-script
 */

import { newAssetId } from '@/tree/content-graph/types';
import type { MissionTrackStatus, MultiTrackScriptResult } from '@/tree/mission';
import type { MultiTrackProviders } from '@/forest/ai/provider-factory';
import { formatTenantAssetKey } from './asset-keys';
import { vaultToR2IfAvailable, registerContentAsset } from './asset-vault';
import { saveCheckpoint } from './checkpoint-cas';
import { parseScriptIntoScenes } from './script-parser';

export async function runScriptTrack(params: {
  providers: MultiTrackProviders;
  topic: string;
  objective?: string;
  targetDuration: number;
  targetScenes: number;
  workspaceId: string;
  missionId: string;
  trackStatus: MissionTrackStatus;
  checkpointCallback?: (trackStatus: MissionTrackStatus, phase: string) => Promise<void> | void;
}): Promise<MultiTrackScriptResult> {
  const {
    providers,
    topic,
    objective,
    targetDuration,
    targetScenes,
    workspaceId,
    missionId,
    trackStatus,
    checkpointCallback,
  } = params;

  trackStatus.script = 'running';
  await saveCheckpoint(missionId, trackStatus, 'script_generation');
  if (checkpointCallback) {
    await checkpointCallback(trackStatus, 'script_generation');
  }

  const scriptPrompt = `Generate a video script for topic: "${topic}".\nObjective: ${objective || 'Create engaging automated video'}.\nTarget duration: ${targetDuration} seconds.\nEstimated scenes: ${targetScenes}.\nProvide structured narration and scene visual descriptions.`;

  const chatResponse = await providers.scriptProvider.chat(
    [
      {
        role: 'system',
        content:
          'You are an expert viral video director synthesizing multi-track video scripts with visual prompts and voiceover narration.',
      },
      { role: 'user', content: scriptPrompt },
    ],
    { model: 'openrouter/auto', apiKey: '' }
  );

  const parsedScript = parseScriptIntoScenes(chatResponse.content, topic, targetScenes);
  const scriptAssetId = newAssetId();
  const scriptStorageKey = formatTenantAssetKey(workspaceId, missionId, 'script', scriptAssetId, 'json');
  await vaultToR2IfAvailable(scriptStorageKey, JSON.stringify(parsedScript), 'application/json');

  await registerContentAsset({
    id: scriptAssetId,
    workspaceId,
    projectId: missionId,
    type: 'script',
    storageKey: scriptStorageKey,
    mimeType: 'application/json',
    status: 'completed',
    metadata: { scenesCount: parsedScript.scenes.length, wordCount: parsedScript.wordCount },
  });

  trackStatus.script = 'completed';
  const scriptTrackResult = { ...parsedScript, storageKey: scriptStorageKey, assetId: scriptAssetId };
  await saveCheckpoint(missionId, trackStatus, 'script_completed');
  if (checkpointCallback) {
    await checkpointCallback(trackStatus, 'script_completed');
  }

  return scriptTrackResult;
}
