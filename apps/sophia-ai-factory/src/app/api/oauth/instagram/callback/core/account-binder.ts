import { randomUUID } from 'crypto';
import { createServerClient } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import type { InstagramMeResponse } from './types';

export async function bindInstagramAccount(
  userId: string,
  meData: InstagramMeResponse,
  longLivedToken: { accessToken: string; expiresIn?: number },
): Promise<void> {
  const encryptedToken = await encryptToken(longLivedToken.accessToken);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (longLivedToken.expiresIn ?? 60 * 24 * 3600);

  const db = createServerClient();
  const tenantId = userId;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'instagram')
    .eq('external_account_id', meData.id)
    .single();

  if (existing) {
    await db
      .from('publishing_channels')
      .update({
        access_token: encryptedToken,
        expires_at: expiresAt,
        status: 'active',
        display_name: meData.name ?? meData.id,
        updated_at: now,
      })
      .eq('id', (existing as { id: string }).id);
  } else {
    await db.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: userId,
      provider: 'instagram',
      external_account_id: meData.id,
      display_name: meData.name ?? meData.id,
      access_token: encryptedToken,
      refresh_token: null,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }
}
