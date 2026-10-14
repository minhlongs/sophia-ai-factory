/**
 * Path B: Runpod HunyuanVideo 1.5 HTTP Client & Polling Helpers
 *
 * @module land/video/publishing/path-b-runpod-client
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import type { ScenePrompt } from '@/land/video/generation/visual-prompt-generator';

export const RUNPOD_SERVICE_NAME = 'runpod';

export interface RunpodSubmitResponse {
  id: string;
  status: string;
}

export interface RunpodStatusResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  output?: { r2_key?: string; download_url?: string } | null;
  error?: string | null;
}

const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 48; // ~8 minutes max

export async function submitRunpodJob(
  apiKey: string,
  endpointId: string,
  scenes: ScenePrompt[],
  durationSec: number,
  fps: number,
): Promise<RunpodSubmitResponse> {
  if (!shouldAllowRequest(RUNPOD_SERVICE_NAME)) {
    throw new Error(`[${RUNPOD_SERVICE_NAME}] Circuit breaker open`);
  }
  try {
    const res = await fetch(`https://api.runpod.io/v2/${endpointId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: { prompts: scenes.map((s) => s.description), duration: durationSec, fps } }),
    });
    if (!res.ok) {
      const kind = classifyHttpStatus(res.status);
      recordFailure(RUNPOD_SERVICE_NAME, kind);
      throw new Error(`[PathB] Runpod submit failed: ${res.status}`);
    }
    const result = (await res.json()) as RunpodSubmitResponse;
    recordSuccess(RUNPOD_SERVICE_NAME);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(RUNPOD_SERVICE_NAME, kind);
    throw error;
  }
}

export async function pollRunpodJob(
  apiKey: string,
  endpointId: string,
  runpodJobId: string,
): Promise<RunpodStatusResponse> {
  for (let i = 0; i < MAX_POLLS; i++) {
    if (!shouldAllowRequest(RUNPOD_SERVICE_NAME)) {
      throw new Error(`[${RUNPOD_SERVICE_NAME}] Circuit breaker open`);
    }
    try {
      const res = await fetch(`https://api.runpod.io/v2/${endpointId}/status/${runpodJobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const kind = classifyHttpStatus(res.status);
        recordFailure(RUNPOD_SERVICE_NAME, kind);
        throw new Error(`[PathB] Runpod status check failed: ${res.status}`);
      }
      const status = (await res.json()) as RunpodStatusResponse;
      recordSuccess(RUNPOD_SERVICE_NAME);

      if (status.status === 'COMPLETED') return status;
      if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        throw new Error(`[PathB] Runpod job ${runpodJobId} ended with status: ${status.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
      const kind = classifyError(error);
      recordFailure(RUNPOD_SERVICE_NAME, kind);
      throw error;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`[PathB] Runpod job ${runpodJobId} timed out after ${MAX_POLLS} polls`);
}

export async function downloadRunpodVideoBytes(downloadUrl: string): Promise<ArrayBuffer> {
  if (!shouldAllowRequest(RUNPOD_SERVICE_NAME)) {
    throw new Error(`[${RUNPOD_SERVICE_NAME}] Circuit breaker open`);
  }
  try {
    const videoRes = await fetch(downloadUrl);
    if (!videoRes.ok) {
      const kind = classifyHttpStatus(videoRes.status);
      recordFailure(RUNPOD_SERVICE_NAME, kind);
      throw new Error(`[PathB] Failed to download video: ${videoRes.status}`);
    }
    const videoBytes = await videoRes.arrayBuffer();
    recordSuccess(RUNPOD_SERVICE_NAME);
    return videoBytes;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(RUNPOD_SERVICE_NAME, kind);
    throw error;
  }
}
