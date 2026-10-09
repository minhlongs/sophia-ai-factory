/**
 * Client transport and constructor part of the TypeScript SDK template
 *
 * Layer: app/api/sdk/typescript
 */

export const SDK_CLIENT_TRANSPORT_PART = `
function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      return controller.signal;
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}

export class SophiaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(optsOrToken: SophiaClientOptions | string, baseUrl?: string) {
    if (typeof optsOrToken === 'string') {
      this.apiKey = optsOrToken;
      this.baseUrl = (baseUrl ?? 'https://sophia.agencyos.network').replace(/\\/$/, '');
      this.timeoutMs = 30000;
    } else {
      this.apiKey = optsOrToken.apiKey ?? optsOrToken.token ?? '';
      this.baseUrl = (optsOrToken.baseUrl ?? baseUrl ?? 'https://sophia.agencyos.network').replace(/\\/$/, '');
      this.timeoutMs = optsOrToken.timeoutMs ?? 30000;
    }
  }

  private get authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = \`Bearer \${this.apiKey}\`;
    }
    return headers;
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
    ro?: RequestOptions,
  ): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    const timeout = ro?.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        controller.abort(new Error(\`Request timeout after \${timeout}ms\`));
      }, timeout);
    }

    const signal = ro?.signal
      ? combineSignals([ro.signal, controller.signal])
      : controller.signal;

    try {
      const resp = await fetch(url, {
        ...options,
        signal,
        headers: {
          ...this.authHeaders,
          ...(options?.headers as Record<string, string> | undefined),
        },
      });

      if (!resp.ok) {
        let errorBody: string;
        try {
          errorBody = await resp.text();
        } catch {
          errorBody = '<failed to read response body>';
        }
        throw new SophiaApiError(
          \`Sophia API error \${resp.status}: \${errorBody.slice(0, 300)}\`,
          resp.status,
          errorBody,
        );
      }

      return (await resp.json()) as T;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
`;
