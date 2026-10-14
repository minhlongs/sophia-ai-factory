import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/land/services/errors';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';
import { HEYGEN_API_URL } from './types';

export async function sendHeyGenRequest<T>(
  apiKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!shouldAllowRequest('heygen')) {
    throw new Error('Circuit breaker open for HeyGen — too many failures');
  }

  try {
    const response = await fetch(`${HEYGEN_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 401 || response.status === 403) {
        recordFailure('heygen', FailureKind.AUTH_FAILURE);
        throw new ProviderInvalidKeyError('heygen', errorBody);
      }
      if (response.status === 429 || response.status === 402) {
        recordFailure('heygen', FailureKind.RATE_LIMIT);
        throw new ProviderQuotaExceededError('heygen', errorBody);
      }
      recordFailure('heygen', FailureKind.SERVER_ERROR);
      throw new Error(`HeyGen API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    recordSuccess('heygen');
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ProviderInvalidKeyError || error instanceof ProviderQuotaExceededError) {
      throw error;
    }
    const kind = classifyError(error);
    recordFailure('heygen', kind);
    throw error;
  }
}
