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
import { getD1 } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import {
  insertNewPublishingChannel,
  newChannelId,
  RegisterChannelError,
  updateExistingPublishingChannel,
  validateRegisterInput,
  type PublishProvider,
  type RegisterChannelInput,
  type RegisterChannelResult,
} from './register-publishing-channel-helpers';

export {
  RegisterChannelError,
  validateRegisterInput,
  type PublishProvider,
  type RegisterChannelInput,
  type RegisterChannelResult,
};

interface ExistingRow {
  id: string;
}

export async function registerPublishingChannel(
  input: RegisterChannelInput,
): Promise<RegisterChannelResult> {
  validateRegisterInput(input);
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
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
    await updateExistingPublishingChannel(
      db,
      existing.id,
      input,
      encryptedAccessToken,
      encryptedRefreshToken,
      nowSec,
    );
    return {
      channelId: existing.id,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      status: 'active',
      alreadyExisted: true,
    };
  }

  const channelId = newChannelId();
  await insertNewPublishingChannel(
    db,
    channelId,
    input,
    encryptedAccessToken,
    encryptedRefreshToken,
    nowSec,
  );

  return {
    channelId,
    provider: input.provider,
    externalAccountId: input.externalAccountId,
    status: 'active',
    alreadyExisted: false,
  };
}
