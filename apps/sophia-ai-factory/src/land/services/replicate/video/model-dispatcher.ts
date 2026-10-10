import {
  ReplicatePrediction,
  ReplicateApiError,
  ReplicateClientError,
} from './types';
import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
  ProviderNetworkError,
} from '@/seed/services/errors';
import { logger } from '@/seed/utils/logger-utility';
import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export async function handleReplicateErrorResponse(response: Response): Promise<never> {
  let errorBody = '';
  try {
    errorBody = await response.text();
  } catch {
    errorBody = '';
  }

  let parsed: ReplicateApiError | undefined;
  try {
    parsed = JSON.parse(errorBody) as ReplicateApiError;
  } catch {
    // ignore parse errors
  }

  const message = parsed?.detail ?? parsed?.title ?? errorBody;

  switch (response.status) {
    case 401:
    case 403:
      throw new ProviderInvalidKeyError('replicate', message);
    case 402:
      throw new ProviderQuotaExceededError('replicate', `Payment required: ${message}`);
    case 429:
      throw new ProviderQuotaExceededError('replicate', `Rate limited: ${message}`);
    default:
      throw new ReplicateClientError(
        response.status,
        `[ReplicateVideoService] API error ${response.status}: ${message}`,
      );
  }
}

export async function submitPrediction(options: {
  baseUrl: string;
  modelOwner: string;
  modelName: string;
  apiKey: string;
  timeoutMs: number;
  input: Record<string, unknown>;
  keyRef?: string;
}): Promise<string> {
  const { baseUrl, modelOwner, modelName, apiKey, timeoutMs, input, keyRef } = options;

  if (!shouldAllowRequest('replicate', keyRef)) {
    throw new ProviderNetworkError('replicate', 'Circuit breaker open — too many failures');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${baseUrl}/models/${modelOwner}/${modelName}/predictions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      await handleReplicateErrorResponse(response);
    }

    const prediction = (await response.json()) as ReplicatePrediction;

    logger.info('[ReplicateVideoService] Prediction created', {
      predictionId: prediction.id,
      status: prediction.status,
    });

    recordSuccess('replicate', keyRef);
    return prediction.id;
  } catch (error) {
    const kind = classifyError(error);
    recordFailure('replicate', kind, keyRef);

    if (error instanceof ReplicateClientError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ProviderNetworkError(
        'replicate',
        `Prediction submission timed out after ${timeoutMs}ms`,
      );
    }
    throw new ProviderNetworkError(
      'replicate',
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
}
