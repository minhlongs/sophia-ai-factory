/**
 * Validation and D1 persistence helpers for registering a publishing channel.
 * @module land/publish/register-publishing-channel-helpers
 */

import type { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const SUPPORTED_PROVIDERS = [
  'tiktok', 'youtube', 'instagram', 'pinterest', 'linkedin', 'zalo',
  'facebook', 'twitter', 'threads', 'reddit', 'bluesky', 'mastodon',
] as const;

export type PublishProvider = (typeof SUPPORTED_PROVIDERS)[number];

export interface RegisterChannelInput {
  userId: string;
  provider: PublishProvider;
  externalAccountId: string;
  accessToken: string;
  displayName?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface RegisterChannelResult {
  channelId: string;
  provider: PublishProvider;
  externalAccountId: string;
  status: 'active';
  /** True when a row already existed (idempotent re-register). */
  alreadyExisted: boolean;
}

export class RegisterChannelError extends Error {
  code: 'INVALID_PROVIDER' | 'INVALID_INPUT' | 'INSERT_FAILED';
  constructor(code: 'INVALID_PROVIDER' | 'INVALID_INPUT' | 'INSERT_FAILED', message: string) {
    super(message);
    this.name = 'RegisterChannelError';
    this.code = code;
  }
}

export function newChannelId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Pure validator — exported so unit tests can exercise it directly.
 */
export function validateRegisterInput(input: RegisterChannelInput): void {
  if (!SUPPORTED_PROVIDERS.includes(input.provider)) {
    throw new RegisterChannelError('INVALID_PROVIDER', `provider must be one of ${SUPPORTED_PROVIDERS.join(', ')}`);
  }
  if (!input.userId || !input.externalAccountId || !input.accessToken) {
    throw new RegisterChannelError('INVALID_INPUT', 'userId, externalAccountId and accessToken are required');
  }
}

type D1Client = NonNullable<Awaited<ReturnType<typeof getD1>>>;

export async function updateExistingPublishingChannel(
  db: D1Client,
  channelId: string,
  input: RegisterChannelInput,
  encryptedAccessToken: string,
  encryptedRefreshToken: string | null,
  nowSec: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE publishing_channels
       SET access_token = ?1, refresh_token = ?2, expires_at = ?3,
           display_name = COALESCE(?4, display_name), status = 'active', updated_at = ?5
       WHERE id = ?6`,
    )
    .bind(encryptedAccessToken, encryptedRefreshToken, input.expiresAt ?? null, input.displayName ?? null, nowSec, channelId)
    .run();
}

export async function insertNewPublishingChannel(
  db: D1Client,
  channelId: string,
  input: RegisterChannelInput,
  encryptedAccessToken: string,
  encryptedRefreshToken: string | null,
  nowSec: number,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO publishing_channels (
           id, tenant_id, user_id, provider, external_account_id,
           display_name, access_token, refresh_token, expires_at,
           status, created_at, updated_at
         ) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'active', ?9, ?9)`,
      )
      .bind(
        channelId, input.userId, input.provider, input.externalAccountId,
        input.displayName ?? null, encryptedAccessToken, encryptedRefreshToken,
        input.expiresAt ?? null, nowSec,
      )
      .run();
  } catch (err) {
    logger.error('[register-publishing-channel] insert failed', toError(err), {
      userId: input.userId,
      provider: input.provider,
    });
    throw new RegisterChannelError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }
}
