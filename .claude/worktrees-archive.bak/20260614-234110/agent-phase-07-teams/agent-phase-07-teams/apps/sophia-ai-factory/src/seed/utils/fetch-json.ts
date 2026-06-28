/**
 * fetchJson — typed JSON fetcher for React Query queryFn usage.
 *
 * Sends credentials (cookies) for same-origin /api/* calls.
 * Throws on non-2xx so React Query transitions to error state.
 *
 * @module seed/utils/fetch-json
 */

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} on ${url}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}
