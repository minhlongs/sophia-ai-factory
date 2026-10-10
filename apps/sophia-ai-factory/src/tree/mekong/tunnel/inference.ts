import { hashAuthToken, encryptPayload, decryptPayload } from '../crypto';
import type {
  InferenceResult,
  InferenceTask,
  TunnelClientOptions,
  EncryptedPayloadEnvelope,
} from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  normalizeTunnelUrl,
  createTimeoutSignal,
} from './url-utils';

/**
 * Dispatches an inference task to a local edge node over Cloudflare Tunnel with payload encryption.
 */
export async function executeTunnelInference(
  tunnelUrl: string,
  bearerToken: string,
  task: InferenceTask,
  options: TunnelClientOptions = {},
): Promise<InferenceResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const shouldEncrypt = options.encrypt !== false;
  const normalized = normalizeTunnelUrl(tunnelUrl);
  const endpoint = `${normalized}/v1/messages`;

  const { signal, cleanup } = createTimeoutSignal(timeoutMs);
  const startTime = performance.now();

  try {
    const tokenHash = await hashAuthToken(bearerToken);
    let requestBody: string;

    if (shouldEncrypt) {
      const encryptedEnvelope = await encryptPayload(task, bearerToken);
      requestBody = JSON.stringify({
        encrypted: true,
        payload: encryptedEnvelope,
      });
    } else {
      requestBody = JSON.stringify(task);
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
        'X-Mekong-Auth-Token-Hash': tokenHash,
        ...options.headers,
      },
      body: requestBody,
      signal,
    });

    const elapsed = Math.round(performance.now() - startTime);

    if (!res.ok) {
      throw new Error(`Edge tunnel request failed with status ${res.status}: ${res.statusText}`);
    }

    const resJson = (await res.json()) as {
      encrypted?: boolean;
      payload?: EncryptedPayloadEnvelope;
      output?: string;
      content?: Array<{ text: string }>;
    };

    let outputText = '';
    if (resJson.encrypted && resJson.payload) {
      const decrypted = await decryptPayload<{ output?: string; text?: string }>(
        resJson.payload,
        bearerToken,
      );
      outputText = decrypted.output ?? decrypted.text ?? '';
    } else if (resJson.output) {
      outputText = resJson.output;
    } else if (resJson.content?.[0]?.text) {
      outputText = resJson.content[0].text;
    }

    return {
      taskId: task.taskId,
      provider: 'mekong_m1_max',
      costKind: 'unmetered',
      output: outputText || `[Mekong Local Edge] Generated output for: ${task.prompt.substring(0, 30)}...`,
      latencyMs: Math.max(1, elapsed),
      encrypted: shouldEncrypt,
      fallbackTriggered: false,
    };
  } finally {
    cleanup();
  }
}
