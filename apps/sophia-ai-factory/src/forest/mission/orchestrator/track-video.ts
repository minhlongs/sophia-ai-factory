/**
 * Video Compositing Track.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/track-video
 */

import { newAssetId } from '@/tree/content-graph/types';
import type {
  MissionTrackStatus,
  MultiTrackAudioResult,
  MultiTrackVideoResult,
  MultiTrackVisualResult,
} from '@/tree/mission';
import type { MultiTrackProviders } from '@/forest/ai/provider-factory';
import { formatTenantAssetKey } from './asset-keys';
import { vaultToR2IfAvailable, registerContentAsset } from './asset-vault';
import { saveCheckpoint } from './checkpoint-cas';

export async function runVideoTrack(params: {
  providers: MultiTrackProviders;
  audioResult: MultiTrackAudioResult;
  visualResult: MultiTrackVisualResult;
  topic: string;
  creatorId: string;
  workspaceId: string;
  missionId: string;
  trackStatus: MissionTrackStatus;
  checkpointCallback?: (trackStatus: MissionTrackStatus, phase: string) => Promise<void> | void;
}): Promise<MultiTrackVideoResult> {
  const {
    providers,
    audioResult,
    visualResult,
    topic,
    creatorId,
    workspaceId,
    missionId,
    trackStatus,
    checkpointCallback,
  } = params;

  trackStatus.video = 'running';
  await saveCheckpoint(missionId, trackStatus, 'video_compositing');
  if (checkpointCallback) {
    await checkpointCallback(trackStatus, 'video_compositing');
  }

  const firstFrameUrl =
    visualResult.frames[0]?.imageUrl ||
    visualResult.frames[0]?.storageKey ||
    'https://placeholder.vault/frame.png';

  const renderJob = await providers.videoProvider.renderVideo(
    {
      audioUrl: audioResult.audioUrl,
      faceUrl: firstFrameUrl,
      options: {
        aspectRatio: visualResult.aspectRatio,
        duration: audioResult.durationSeconds,
        topic,
        scenes: visualResult.frames.map((f) => ({
          index: f.sceneIndex,
          storageKey: f.storageKey,
          prompt: f.prompt,
          imageUrl: f.imageUrl,
        })),
      },
    },
    creatorId
  );

  const videoAssetId = newAssetId();
  const videoStorageKey = formatTenantAssetKey(workspaceId, missionId, 'video', videoAssetId, 'mp4');

  const videoPayload = JSON.stringify({
    jobId: renderJob.jobId,
    provider: providers.videoProvider.id,
    duration: audioResult.durationSeconds,
    aspectRatio: visualResult.aspectRatio,
    renderedAt: new Date().toISOString(),
  });
  await vaultToR2IfAvailable(videoStorageKey, videoPayload, 'video/mp4');

  await registerContentAsset({
    id: videoAssetId,
    workspaceId,
    projectId: missionId,
    type: 'video',
    storageKey: videoStorageKey,
    mimeType: 'video/mp4',
    durationSeconds: Math.round(audioResult.durationSeconds),
    status: 'completed',
    metadata: {
      jobId: renderJob.jobId,
      provider: providers.videoProvider.id,
      aspectRatio: visualResult.aspectRatio,
      scenesCount: visualResult.frames.length,
    },
  });

  trackStatus.video = 'completed';
  const videoTrackResult = {
    videoUrl: videoStorageKey,
    storageKey: videoStorageKey,
    durationSeconds: audioResult.durationSeconds,
    mimeType: 'video/mp4',
    assetId: videoAssetId,
    aspectRatio: visualResult.aspectRatio,
    provider: providers.videoProvider.id,
  };

  await saveCheckpoint(missionId, trackStatus, 'composited');
  if (checkpointCallback) {
    await checkpointCallback(trackStatus, 'composited');
  }

  return videoTrackResult;
}
