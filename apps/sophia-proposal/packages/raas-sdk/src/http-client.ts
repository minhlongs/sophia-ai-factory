/**
 * @sophia/raas-sdk — Minimal fetch wrapper.
 * Handles auth headers, JSON parsing, 429 auto-retry with Retry-After.
 */

export class RaasHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'RaasHttpError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

const MAX_RETRIES = 3;

/**
 * Sleep for `ms` milliseconds — uses setTimeout so it works in all runtimes.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse Retry-After header value into milliseconds.
 * Accepts integer seconds or HTTP-date string.
 */
function retryAfterMs(header: string | null): number {
  if (!header) return 1000;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  // HTTP-date fallback
  const date = new Date(header);
  const delta = date.getTime() - Date.now();
  return delta > 0 ? delta : 1000;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    // Strip trailing slash for consistent path concatenation
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body } = options;
    const url = `${this.baseUrl}${path}`;

    let attempt = 0;
    while (true) {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      // Handle 429 with auto-retry
      if (res.status === 429 && attempt < MAX_RETRIES) {
        attempt++;
        const wait = retryAfterMs(res.headers.get('Retry-After'));
        await sleep(wait);
        continue;
      }

      // Parse response body regardless of status for error messages
      let data: unknown;
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      if (!res.ok) {
        const msg =
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof (data as Record<string, unknown>)['error'] === 'string'
            ? (data as Record<string, unknown>)['error'] as string
            : `HTTP ${res.status}`;
        throw new RaasHttpError(res.status, data, msg);
      }

      return data as T;
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }
}
