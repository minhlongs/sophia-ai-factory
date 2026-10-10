/**
 * Types & access helpers for SOP Creator listing detail
 */

export interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export interface ListingDetailProps {
  locale: string;
  listingId: string;
  userId: string;
}
