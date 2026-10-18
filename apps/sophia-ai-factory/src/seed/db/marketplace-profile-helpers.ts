/**
 * SOP Creator Marketplace — profile record builder & update query helpers.
 *
 * @module seed/db/marketplace-profile-helpers
 */

import type { CreateCreatorProfileInput, CreatorProfile } from './marketplace-types';

/**
 * Constructs a normalized CreatorProfile entity from input fields.
 */
export function buildCreatorProfileRecord(
  input: CreateCreatorProfileInput,
  now: number = Math.floor(Date.now() / 1000),
): CreatorProfile {
  return {
    id: crypto.randomUUID(),
    user_id: input.user_id,
    display_name: input.display_name,
    bio: input.bio ?? null,
    avatar_url: input.avatar_url ?? null,
    payout_method: input.payout_method ?? null,
    payout_address: input.payout_address ?? null,
    total_earnings_cents: 0,
    total_paid_cents: 0,
    status: input.status ?? 'pending',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Builds parameterized SQL SET clauses and bind values for creator profile updates.
 */
export function buildProfileUpdateClause(
  userId: string,
  input: Partial<CreateCreatorProfileInput>,
  now: number = Math.floor(Date.now() / 1000),
): { fields: string[]; values: unknown[] } {
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (input.display_name !== undefined) {
    fields.push('display_name = ?');
    values.push(input.display_name);
  }
  if (input.bio !== undefined) {
    fields.push('bio = ?');
    values.push(input.bio);
  }
  if (input.avatar_url !== undefined) {
    fields.push('avatar_url = ?');
    values.push(input.avatar_url);
  }
  if (input.payout_method !== undefined) {
    fields.push('payout_method = ?');
    values.push(input.payout_method);
  }
  if (input.payout_address !== undefined) {
    fields.push('payout_address = ?');
    values.push(input.payout_address);
  }
  if (input.status !== undefined) {
    fields.push('status = ?');
    values.push(input.status);
  }

  values.push(userId);
  return { fields, values };
}
