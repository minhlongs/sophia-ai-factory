/**
 * Affiliate Discovery & Adoption Helpers
 * Layer: forest (Server Action Internal Helpers)
 *
 * @module forest/actions/affiliate/discovery-helpers
 */

import { getD1 } from '@/seed/db/client';
import type { AdoptAffiliateOfferInput, AffiliateOffer } from './types';

/**
 * Best-effort persistence of an adopted affiliate campaign run to D1.
 */
export async function persistAdoptedCampaignRun(params: {
  campaignId: string;
  programTitle: string;
  input: AdoptAffiliateOfferInput;
  offer?: AffiliateOffer;
  now: number;
}): Promise<void> {
  const { campaignId, programTitle, input, offer, now } = params;
  const db = await getD1();
  if (!db) return;

  try {
    await db
      .prepare(
        `INSERT INTO campaign_runs (id, campaign_id, title, status, metadata, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'queued', ?4, ?5, ?5)`
      )
      .bind(
        `run_${crypto.randomUUID().slice(0, 8)}`,
        campaignId,
        `${programTitle} (${input.target === 'creator_studio' ? 'Creator Studio' : 'Distribution Queue'})`,
        JSON.stringify({
          offerId: input.offerId,
          target: input.target,
          destinationUrl: offer?.destinationUrl,
          epc: offer?.epc,
          commissionTerms: offer?.commissionTerms,
          adoptedAt: now,
        }),
        now
      )
      .run()
      .catch(() => {
        // Non-fatal if table doesn't exist
      });
  } catch {
    // Non-fatal
  }
}
