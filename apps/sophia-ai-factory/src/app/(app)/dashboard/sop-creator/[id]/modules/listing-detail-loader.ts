import { notFound } from 'next/navigation';
import { getD1 } from '@/seed/db/client';
import { getSopListing, getCreatorProfile, type SopListing } from '@/seed/db/marketplace-ops';
import { requireOrgMembership } from '@/seed/db/org-membership';

export async function loadCreatorListingOrThrow(
  listingId: string,
  userId: string,
): Promise<{ d1Available: false } | { d1Available: true; listing: SopListing }> {
  const d1 = await getD1();
  if (!d1) {
    return { d1Available: false };
  }

  const listing = await getSopListing(d1, listingId);
  if (!listing) {
    notFound();
  }

  const orgResult = await requireOrgMembership(userId);
  const tenantId = orgResult.authorized ? orgResult.orgId : 'default';
  const profile = await getCreatorProfile(d1, userId, tenantId);

  if (!profile || listing.creator_id !== profile.id) {
    notFound();
  }

  return { d1Available: true, listing };
}
