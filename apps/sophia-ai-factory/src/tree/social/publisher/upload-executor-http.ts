/**
 * Shared HTTP primitives and types for the social platform upload executor.
 * Layer: tree (domain reusable logic — imports seed only)
 * @module tree/social/publisher/upload-executor-http
 */

import type { SocialPlatform } from '@/seed/types/social-publisher-types';

export interface UploadExecutionInput {
  platform: SocialPlatform;
  accessToken: string;
  videoUrl: string;
  jobId: string;
  channelId: string;
  title: string;
  description: string;
  tags?: string[];
  totalSizeBytes?: number;
  /**
   * Video duration in seconds, when known. Compared against the maximum
   * duration TikTok reports for this creator, so an over-long upload is
   * refused before the bytes are spent.
   */
  durationSeconds?: number;
  /**
   * Caller's decision on whether the upload is synthetic or meaningfully
   * altered, when the caller actually has one. Omitted means the platform
   * adapters apply their own disclosure policy; it never means "no".
   */
  containsSyntheticMedia?: boolean;
  /** Injectable for tests; production uses the global fetch. */
  fetchImpl?: typeof fetch;
}

export interface UploadExecutionResult {
  platformPostId: string;
  publishedUrl: string;
}

/**
 * Thrown when a provider accepts a request but the response cannot yield a
 * real post id. Distinct from an HTTP failure so callers can tell "provider
 * said no" apart from "we could not finish observing the provider".
 */
export class ProviderResultUnverifiableError extends Error {
  constructor(
    public readonly platform: SocialPlatform,
    public readonly reason: string,
  ) {
    super(`PROVIDER_RESULT_UNVERIFIABLE: ${platform} upload could not yield a real post id (${reason}).`);
    this.name = 'ProviderResultUnverifiableError';
  }
}

export function assertOkResponse(res: Response): void {
  if (res.ok) return;
  throw new Error(`HTTP_${res.status}`);
}

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...headers },
    body: JSON.stringify(body),
  });
  assertOkResponse(res);
  return (await res.json()) as unknown;
}

export function readString(source: unknown, path: readonly string[]): string {
  let cursor: unknown = source;
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null) return '';
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === 'string' && cursor.length > 0 ? cursor : '';
}

export async function postInstagramStep(
  endpoint: string,
  body: unknown,
  accessToken: string,
  fetchImpl: typeof fetch,
  missingError: string,
): Promise<string> {
  const payload = await postJson(endpoint, body, { Authorization: `Bearer ${accessToken}` }, fetchImpl);
  const id = readString(payload, ['id']);
  if (!id) throw new ProviderResultUnverifiableError('INSTAGRAM_REELS', missingError);
  return id;
}
