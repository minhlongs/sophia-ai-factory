/**
 * Algorithm: register a publishing channel (BYOK OAuth) so the existing
 * publisher cron can target it.
 *
 * Delivers the homepage promise of multi-platform distribution
 * (YouTube/TikTok/IG/FB/Twitter/Pinterest/LinkedIn/Threads/Reddit/Bluesky/
 * Mastodon/Zalo) by turning the publishing_channels table — which already
 * supports all 12 providers via CHECK constraint — into a one-call
 * registration API.
 *
 * Doctrine: customer brings their own OAuth tokens via the Setup Wizard
 * or this algorithm; operator stores no third-party tokens.
 *
 * @module land/publish/register-publishing-channel
 */
import { getD1Raw } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

const SUPPORTED_PROVIDERS = [
  'tiktok',
  'youtube',
  'instagram',
  'pinterest',
  'linkedin',
  'zalo',
  'facebook',
  'twitter',
  'threads',
  'reddit',
  'bluesky',
  'mastodon',
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

function newChannelId(): string {
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
    throw new RegisterChannelError(
      'INVALID_INPUT',
      'userId, externalAccountId and accessToken are required',
    );
  }
}

interface ExistingRow {
  id: string;
}

export async function registerPublishingChannel(
  input: RegisterChannelInput,
): Promise<RegisterChannelResult> {
  validateRegisterInput(input);
  const db = await getD1Raw();
  const nowSec = Math.floor(Date.now() / 1000);

  // Encrypt tokens before any DB write so plaintext never touches the store.
  const encryptedAccessToken = await encryptToken(input.accessToken);
  const encryptedRefreshToken = input.refreshToken ? await encryptToken(input.refreshToken) : null;

  // Idempotency: re-register against the same (user, provider, accountId)
  // returns the existing row id instead of inserting a duplicate.
  const existing = await db
    .prepare(
      `SELECT id FROM publishing_channels
       WHERE tenant_id = ?1 AND provider = ?2 AND external_account_id = ?3
       LIMIT 1`,
    )
    .bind(input.userId, input.provider, input.externalAccountId)
    .first<ExistingRow>();

  if (existing) {
    // Refresh token info on re-register — keeps the row usable.
    await db
      .prepare(
        `UPDATE publishing_channels
         SET access_token = ?1,
             refresh_token = ?2,
             expires_at = ?3,
             display_name = COALESCE(?4, display_name),
             status = 'active',
             updated_at = ?5
         WHERE id = ?6`,
      )
      .bind(
        encryptedAccessToken,
        encryptedRefreshToken,
        input.expiresAt ?? null,
        input.displayName ?? null,
        nowSec,
        existing.id,
      )
      .run();
    return {
      channelId: existing.id,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      status: 'active',
      alreadyExisted: true,
    };
  }

  const channelId = newChannelId();
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
        channelId,
        input.userId,
        input.provider,
        input.externalAccountId,
        input.displayName ?? null,
        encryptedAccessToken,
        encryptedRefreshToken,
        input.expiresAt ?? null,
        nowSec,
      )
      .run();
  } catch (err) {
    logger.error('[register-publishing-channel] insert failed', toError(err), {
      userId: input.userId,
      provider: input.provider,
    });
    throw new RegisterChannelError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  return {
    channelId,
    provider: input.provider,
    externalAccountId: input.externalAccountId,
    status: 'active',
    alreadyExisted: false,
  };
}
