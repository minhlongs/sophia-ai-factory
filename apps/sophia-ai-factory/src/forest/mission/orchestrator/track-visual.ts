/**
 * Visual Frame Generation Track.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/track-visual
 */

import { newAssetId } from '@/tree/content-graph/types';
import { MissionError } from '@/tree/mission/types';
import type {
  MissionTrackStatus,
  ScriptScene,
  MultiTrackVisualFrame,
  MultiTrackVisualResult,
} from '@/tree/mission';
import type { MultiTrackProviders } from '@/forest/ai/provider-factory';
import { formatTenantAssetKey } from './asset-keys';
import { vaultToR2IfAvailable, registerContentAsset } from './asset-vault';
import { saveCheckpoint } from './checkpoint-cas';

export async function runVisualTrack(params: {
  providers: MultiTrackProviders;
  scenes: ScriptScene[];
  workspaceId: string;
  missionId: string;
  rawRatio?: string;
  trackStatus: MissionTrackStatus;
  parallelSignal: AbortSignal;
  abortController: AbortController;
}): Promise<MultiTrackVisualResult> {
  const {
    providers,
    scenes,
    workspaceId,
    missionId,
    rawRatio,
    trackStatus,
    parallelSignal,
    abortController,
  } = params;

  try {
    if (parallelSignal.aborted) {
      trackStatus.visual = 'cancelled';
      throw new MissionError('ABORTED', 'Visual track cancelled due to abort signal');
    }

    const validRatio: '1:1' | '16:9' | '9:16' | '4:3' =
      rawRatio === '1:1' || rawRatio === '16:9' || rawRatio === '9:16' || rawRatio === '4:3'
        ? rawRatio
        : '9:16';
    const frames: MultiTrackVisualFrame[] = [];

    for (const scene of scenes) {
      if (parallelSignal.aborted) {
        trackStatus.visual = 'cancelled';
        throw new MissionError('ABORTED', 'Visual track cancelled before scene rendering');
      }

      const imgRes = await providers.imageProvider.generate({
        prompt: scene.prompt,
        aspectRatio: validRatio,
      });

      if (parallelSignal.aborted) {
        trackStatus.visual = 'cancelled';
        throw new MissionError('ABORTED', 'Visual track cancelled after scene rendering');
      }

      const frameAssetId = newAssetId();
      const frameStorageKey = formatTenantAssetKey(
        workspaceId,
        missionId,
        'visual',
        `${scene.index}_${frameAssetId}`,
        'png'
      );

      if (imgRes.assetRef) {
        await vaultToR2IfAvailable(frameStorageKey, imgRes.assetRef, 'image/png');
      }

      await registerContentAsset({
        id: frameAssetId,
        workspaceId,
        projectId: missionId,
        type: 'image',
        storageKey: frameStorageKey,
        mimeType: 'image/png',
        status: 'completed',
        metadata: { sceneIndex: scene.index, provider: imgRes.provider, prompt: scene.prompt },
      });

      frames.push({
        sceneIndex: scene.index,
        prompt: scene.prompt,
        storageKey: frameStorageKey,
        imageUrl: imgRes.assetRef || frameStorageKey,
        assetId: frameAssetId,
        mimeType: 'image/png',
      });
    }

    if (parallelSignal.aborted) {
      trackStatus.visual = 'cancelled';
      throw new MissionError('ABORTED', 'Visual track cancelled before checkpoint');
    }

    trackStatus.visual = 'completed';
    await saveCheckpoint(missionId, trackStatus, 'voice_and_visuals');

    return {
      frames,
      aspectRatio: validRatio,
      totalScenes: frames.length,
    };
  } catch (err) {
    if (!parallelSignal.aborted) {
      trackStatus.visual = 'failed';
      abortController.abort(err);
    } else if (trackStatus.visual === 'running') {
      trackStatus.visual = 'cancelled';
    }
    throw err;
  }
}
