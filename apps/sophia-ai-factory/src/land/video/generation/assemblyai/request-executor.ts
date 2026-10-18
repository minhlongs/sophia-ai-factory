/**
 * @file request-executor.ts
 * @layer land/video/generation/assemblyai
 * @description Circuit-breaker-protected HTTP request executor and payload builder for AssemblyAI API calls.
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { TranscribeParams } from './types';
import { handleErrorResponse } from './error-handler';

export interface AssemblyAIRequestOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  path: string;
  operation: 'transcribe' | 'getTranscript' | 'getSubtitles';
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
}

export function buildTranscribeRequestBody(params: TranscribeParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    audio_url: params.audioUrl,
    punctuate: params.punctuate ?? true,
  };

  if (params.languageCode && params.languageCode !== 'auto') {
    body.language_code = params.languageCode;
  }

  if (params.speakerLabels === true) {
    body.speaker_labels = true;
  }

  return body;
}

export async function executeAssemblyAIRequest<T>(
  options: AssemblyAIRequestOptions,
  parseResponse: (response: Response) => Promise<T>,
): Promise<T> {
  if (!shouldAllowRequest('assemblyai')) {
    logger.warn('[AssemblyAIClient] Circuit breaker open for assemblyai, request blocked');
    throw new Error('Circuit breaker open for assemblyai — request blocked');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  const headers: Record<string, string> = {
    Authorization: options.apiKey,
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${options.baseUrl}${options.path}`, {
      ...(options.method ? { method: options.method } : {}),
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });

    if (!response.ok) {
      await handleErrorResponse(response, options.operation);
    }

    const result = await parseResponse(response);
    recordSuccess('assemblyai');
    return result;
  } catch (error) {
    recordFailure('assemblyai', classifyError(error));
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
