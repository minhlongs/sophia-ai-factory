/**
 * SOP Creator Marketplace — SOP listing update operation.
 *
 * @module seed/db/marketplace-listings-update
 */

import type { D1Database } from '@cloudflare/workers-types';
import { toError } from '@/seed/utils/to-error';
import type { CreateSopListingInput, SopListing } from './marketplace-types';
import { getSopListing } from './marketplace-listings-queries';

const UPDATABLE_COLUMNS: ReadonlyArray<keyof CreateSopListingInput> = [
  'title',
  'description',
  'price_cents',
  'category',
  'tags',
  'thumbnail_url',
  'demo_video_url',
  'sop_template_id',
  'status',
];

/**
 * Update an SOP listing by its ID.
 * Only provided fields are updated.
 * Returns the updated listing, or null if not found.
 */
export async function updateSopListing(
  db: D1Database,
  listingId: string,
  input: Partial<CreateSopListingInput>,
): Promise<SopListing | null> {
  const now = Math.floor(Date.now() / 1000);
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  for (const col of UPDATABLE_COLUMNS) {
    if (input[col] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(input[col]);
    }
  }

  values.push(listingId);

  try {
    await db
      .prepare(`UPDATE sop_listings SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return getSopListing(db, listingId);
  } catch (error) {
    throw toError(error);
  }
}
