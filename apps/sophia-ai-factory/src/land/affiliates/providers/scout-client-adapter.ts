/**
 * Adapter converting a scout NetworkClient into an OfferProvider for Discovery Wave.
 * @module land/affiliates/providers/scout-client-adapter
 */

import type { OfferProvider, AffiliateOffer, ListOffersOpts } from '../provider-interface';
import { asTrending } from '../provider-interface';
import type { NetworkClient, ScoutEnv } from '../scout/types';

export class ScoutClientOfferProvider implements OfferProvider {
  readonly networkSlug: string;

  constructor(
    private readonly client: NetworkClient,
    private readonly env: ScoutEnv = process.env as ScoutEnv,
    private readonly tenantId?: string,
    private readonly credentialsOverride?: Record<string, string>,
  ) {
    this.networkSlug = client.network;
  }

  async listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]> {
    if (!this.tenantId) {
      throw new Error(`Missing authenticated tenantId for discovery on network ${this.networkSlug}`);
    }
    const raw = await this.client.fetch(this.env, this.tenantId, this.credentialsOverride);
    const filtered = opts?.niche
      ? raw.filter((r) => {
          if (!r.category) return true;
          const cat = r.category.toLowerCase();
          const target = opts.niche!.toLowerCase();
          if (cat === 'general' || target === 'general' || target === 'all') return true;
          const catRoot = cat.split('_')[0];
          const targetRoot = target.split('_')[0];
          return cat.includes(target) || target.includes(cat) || (catRoot.length >= 3 && catRoot === targetRoot);
        })
      : raw;

    return (opts?.limit ? filtered.slice(0, opts.limit) : filtered).map((r) => ({
      externalId: r.externalId,
      title: r.productName,
      description: r.description ?? '',
      imageUrl: '',
      productUrl: r.productUrl ?? '',
      commissionPct: r.commissionPct ?? null,
      commissionFixedUsd: r.commissionFlatUsd ?? null,
      cryptoVolumeUsd: r.cryptoVolumeUsd ?? undefined,
      niche: r.category ?? 'general',
      language: 'en',
      region: 'GLOBAL',
      isTrending: false,
    }));
  }

  async getOffer(externalId: string): Promise<AffiliateOffer | null> {
    const all = await this.listOffers();
    return all.find((o) => o.externalId === externalId) ?? null;
  }

  async getTrending(niche: string): Promise<AffiliateOffer[]> {
    const offers = await this.listOffers({ niche, limit: 50 });
    return offers.map(asTrending);
  }
}
