import { randomUUID } from 'crypto';
import { createServerClient } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import type { ZaloTokenResponse } from './types';

export async function bindZaloChannel(
  userId: string,
  tokenData: ZaloTokenResponse,
  resolvedOaId: string,
  displayName: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const encryptedAccess = await encryptToken(tokenData.access_token!);
  const encryptedRefresh = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;
  const expiresAt = now + (tokenData.expires_in ?? 3600);

  const db = createServerClient();
  const tenantId = userId;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'zalo')
    .eq('external_account_id', resolvedOaId)
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
      provider: 'zalo',
      external_account_id: resolvedOaId,
      display_name: displayName,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[Zalo Callback] Channel connected', { userId, oaId: resolvedOaId });
}
