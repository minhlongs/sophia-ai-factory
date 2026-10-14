import { createServerClient } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { randomUUID } from 'crypto';
import { PinterestTokenResponse, PinterestUserResponse } from './types';

export async function persistPublishingChannel(
  userId: string,
  tokenData: PinterestTokenResponse,
  meData: PinterestUserResponse,
  boardId: string,
  boardName: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const encryptedAccess = await encryptToken(tokenData.access_token!);
  const encryptedRefresh = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;
  const expiresAt = now + (tokenData.expires_in ?? 3600);

  const db = createServerClient();
  const tenantId = userId;

  const displayName = meData.username
    ? `${meData.username} · ${boardName}`
    : `${meData.id} · ${boardName}`;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'pinterest')
    .eq('external_account_id', boardId)
    .single();

  if (existing) {
    await db
      .from('publishing_channels')
      .update({
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        status: 'active',
        display_name: displayName,
        updated_at: now,
      })
      .eq('id', (existing as { id: string }).id);
  } else {
    await db.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: userId,
      provider: 'pinterest',
      external_account_id: boardId,
      display_name: displayName,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[Pinterest Callback] Channel connected', {
    userId,
    pinterestUserId: meData.id,
    boardId,
  });
}
