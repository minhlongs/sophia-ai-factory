/**
 * Audio Voiceover Generation Track.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/track-audio
 */

import { newAssetId } from '@/tree/content-graph/types';
import { MissionError } from '@/tree/mission/types';
import type {
  MissionTrackStatus,
  MultiTrackAudioResult,
} from '@/tree/mission';
import type { MultiTrackProviders } from '@/forest/ai/provider-factory';
import { formatTenantAssetKey } from './asset-keys';
import { vaultToR2IfAvailable, registerContentAsset } from './asset-vault';
import { saveCheckpoint } from './checkpoint-cas';

export async function runAudioTrack(params: {
  providers: MultiTrackProviders;
  fullNarration: string;
  creatorId: string;
  workspaceId: string;
  missionId: string;
  targetDuration: number;
  voiceId?: string;
  voiceStyle?: string;
  trackStatus: MissionTrackStatus;
  parallelSignal: AbortSignal;
  abortController: AbortController;
}): Promise<MultiTrackAudioResult> {
  const {
    providers,
    fullNarration,
    creatorId,
    workspaceId,
    missionId,
    targetDuration,
    voiceId,
    voiceStyle,
    trackStatus,
    parallelSignal,
    abortController,
  } = params;

  try {
    if (parallelSignal.aborted) {
      trackStatus.audio = 'cancelled';
      throw new MissionError('ABORTED', 'Audio track cancelled due to abort signal');
    }

    const voiceRes = await providers.audioProvider.generateSpeech(
      {
        text: fullNarration,
        voiceId,
        model: voiceStyle,
      },
      creatorId
    );

    if (parallelSignal.aborted) {
      trackStatus.audio = 'cancelled';
      throw new MissionError('ABORTED', 'Audio track cancelled after speech generation');
    }

    const audioAssetId = newAssetId();
    const audioStorageKey = formatTenantAssetKey(workspaceId, missionId, 'audio', audioAssetId, 'mp3');

    if (voiceRes.audioBuffer && voiceRes.audioBuffer.byteLength > 0) {
      await vaultToR2IfAvailable(audioStorageKey, voiceRes.audioBuffer, 'audio/mpeg');
    }

    if (parallelSignal.aborted) {
      trackStatus.audio = 'cancelled';
      throw new MissionError('ABORTED', 'Audio track cancelled before asset registration');
    }

    await registerContentAsset({
      id: audioAssetId,
      workspaceId,
      projectId: missionId,
      type: 'audio',
      storageKey: audioStorageKey,
      mimeType: 'audio/mpeg',
      durationSeconds: Math.round(voiceRes.durationSeconds || targetDuration),
      sizeBytes: voiceRes.audioBuffer?.byteLength ?? 0,
      status: 'completed',
      metadata: { provider: voiceRes.provider, latencyMs: voiceRes.latencyMs },
    });

    if (parallelSignal.aborted) {
      trackStatus.audio = 'cancelled';
      throw new MissionError('ABORTED', 'Audio track cancelled before checkpoint');
    }

    trackStatus.audio = 'completed';
    await saveCheckpoint(missionId, trackStatus, 'voice_and_visuals');

    return {
      audioUrl: voiceRes.audioUrl || audioStorageKey,
      storageKey: audioStorageKey,
      durationSeconds: voiceRes.durationSeconds || targetDuration,
      mimeType: 'audio/mpeg',
      assetId: audioAssetId,
      sizeBytes: voiceRes.audioBuffer?.byteLength ?? 0,
    };
  } catch (err) {
    if (!parallelSignal.aborted) {
      trackStatus.audio = 'failed';
      abortController.abort(err);
    } else if (trackStatus.audio === 'running') {
      trackStatus.audio = 'cancelled';
    }
    throw err;
  }
}
