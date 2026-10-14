import { randomUUID } from 'crypto';
import { createServerClient } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import type { LinkedInTokenResponse, LinkedInProfileResponse } from './types';

export async function bindLinkedInChannel(
  userId: string,
  tokenData: LinkedInTokenResponse,
  profile: LinkedInProfileResponse,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const encryptedAccess = await encryptToken(tokenData.access_token!);
  const encryptedRefresh = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;
  const expiresAt = now + (tokenData.expires_in ?? 60 * 24 * 3600);

  const displayName =
    [profile.localizedFirstName, profile.localizedLastName].filter(Boolean).join(' ') || profile.id!;

  const db = createServerClient();
  const tenantId = userId;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'linkedin')
    .eq('external_account_id', profile.id)
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
      provider: 'linkedin',
      external_account_id: profile.id,
      display_name: displayName,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[LinkedIn Callback] Channel connected', { userId, linkedInId: profile.id });
}
