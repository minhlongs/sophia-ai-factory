/**
 * Affiliate Offer Provider Interface
 *
 * Uniform contract all network adapters implement.
 * Any field differences between networks are normalized here.
 *
 * @module affiliates/provider-interface
 */

/** Uniform offer shape returned by all network adapters */
export interface AffiliateOffer {
  /** Network-specific unique ID */
  externalId: string
  /** Offer title / product name */
  title: string
  /** Short description */
  description: string
  /** Product image URL */
  imageUrl: string
  /** Affiliate-trackable product URL */
  productUrl: string
  /** Commission percentage (0-100), null if fixed only */
  commissionPct: number | null
  /** Fixed commission in USD, null if percent only */
  commissionFixedUsd: number | null
  /** Vertical / category niche tag */
  niche: string
  /** ISO 639-1 language code (e.g. "vi", "en") */
  language: string
  /** ISO 3166-1 alpha-2 region (e.g. "VN", "US") */
  region: string
  /** Whether provider marks this offer as trending */
  isTrending: boolean
}

/** Options for listOffers */
export interface ListOffersOpts {
  niche?: string
  page?: number
  limit?: number
}

/**
 * Network adapter contract.
 * Each adapter must implement all three methods.
 * If env vars are missing, adapters return mock fixtures.
 */
export interface OfferProvider {
  /** Network slug (e.g. "tiktok-shop", "accesstrade", "clickbank") */
  readonly networkSlug: string

  /** List available offers, optionally filtered by niche */
  listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]>

  /** Get a single offer by network-specific external ID */
  getOffer(externalId: string): Promise<AffiliateOffer | null>

  /** Get trending offers for a niche */
  getTrending(niche: string): Promise<AffiliateOffer[]>
}
