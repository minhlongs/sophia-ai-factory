/**
 * HTTP utilities for scripts and tests
 */

export interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  retryOn?: number[];
}

/**
 * Fetch with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Return if successful or this is the last attempt
      if (response.ok || attempt === maxRetries - 1) {
        return response;
      }
      // Retry on 5xx (non-ok response before last attempt)
      if (response.status >= 500 && response.status < 600) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      // Continue to next attempt if not last
      if (attempt < maxRetries - 1) {
        continue;
      }
      // Last attempt, will throw after loop
    }
  }

  throw lastError ?? new Error('Fetch failed');
}

/**
 * Fetch JSON with retry and timing
 */
export async function getJsonWithRetry<T>(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<{ data: T; status: number; duration: number }> {
  const start = Date.now();
  const response = await fetchWithRetry(url, options, maxRetries);
  const duration = Date.now() - start;
  const data = await response.json();
  return { data, status: response.status, duration };
}

/**
 * Extract shortSha from version response
 */
export function extractShortSha(obj: { shortSha?: string | null }): string | null {
  const { shortSha } = obj;
  if (typeof shortSha === 'string' && shortSha.length > 0) {
    return shortSha;
  }
  return null;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  return `${seconds.toFixed(2)}s`;
}
