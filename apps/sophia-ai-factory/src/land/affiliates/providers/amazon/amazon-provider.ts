/**
 * Amazon PA-API v5 OfferProvider implementation.
 * @module land/affiliates/providers/amazon/amazon-provider
 */

import type { OfferProvider, AffiliateOffer, ListOffersOpts } from '../../provider-interface';
import { asTrending } from '../../provider-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  NETWORK_SLUG,
  CB_SERVICE_NAME,
  PA_API_HOST,
} from './constants';
import {
  type AmazonItem,
  type PaApiResponse,
  mapItem,
  mockOffers,
} from './types';
import { signPaApiRequest } from './sigv4';

export class AmazonProvider implements OfferProvider {
  readonly networkSlug = NETWORK_SLUG;

  private get accessKey(): string | undefined { return process.env.AMAZON_ACCESS_KEY; }
  private get secretKey(): string | undefined { return process.env.AMAZON_SECRET_KEY; }
  private get partnerTag(): string | undefined { return process.env.AMAZON_PARTNER_TAG; }

  async listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]> {
    if (!this.accessKey || !this.secretKey || !this.partnerTag) return mockOffers();
    try {
      if (!shouldAllowRequest(CB_SERVICE_NAME)) {
        return mockOffers();
      }
      const body = JSON.stringify({
        Keywords: opts?.niche ?? 'bestseller',
        PartnerTag: this.partnerTag,
        PartnerType: 'Associates',
        Resources: ['ItemInfo.Title', 'ItemInfo.Features', 'Images.Primary.Medium', 'Offers.Listings.Price', 'BrowseNodeInfo.BrowseNodes'],
        SearchIndex: 'All',
        ItemCount: Math.min(opts?.limit ?? 10, 10),
      });
      const headers = await signPaApiRequest(this.accessKey, this.secretKey, body);
      const res = await fetch(`https://${PA_API_HOST}/paapi5/searchitems`, {
        method: 'POST', headers, body,
      });
      if (!res.ok) {
        const kind = classifyHttpStatus(res.status);
        recordFailure(CB_SERVICE_NAME, kind);
        return mockOffers();
      }
      const json = await res.json() as PaApiResponse;
      recordSuccess(CB_SERVICE_NAME);
      return (json.SearchResult?.Items ?? []).map((i) => mapItem(i, this.partnerTag!));
    } catch (error) {
      const kind = classifyError(error);
      recordFailure(CB_SERVICE_NAME, kind);
      return mockOffers();
    }
  }

  async getOffer(externalId: string): Promise<AffiliateOffer | null> {
    if (!this.accessKey || !this.secretKey || !this.partnerTag) return mockOffers()[0];
    try {
      if (!shouldAllowRequest(CB_SERVICE_NAME)) return null;
      const body = JSON.stringify({
        ItemIds: [externalId],
        PartnerTag: this.partnerTag,
        PartnerType: 'Associates',
        Resources: ['ItemInfo.Title', 'Images.Primary.Medium', 'Offers.Listings.Price'],
      });
      const headers = await signPaApiRequest(this.accessKey, this.secretKey, body);
      const res = await fetch(`https://${PA_API_HOST}/paapi5/getitems`, {
        method: 'POST', headers, body,
      });
      if (!res.ok) {
        const kind = classifyHttpStatus(res.status);
        recordFailure(CB_SERVICE_NAME, kind);
        return null;
      }
      const json = await res.json() as { ItemsResult?: { Items?: AmazonItem[] } };
      const item = json.ItemsResult?.Items?.[0];
      recordSuccess(CB_SERVICE_NAME);
      return item ? mapItem(item, this.partnerTag) : null;
    } catch (error) {
      const kind = classifyError(error);
      recordFailure(CB_SERVICE_NAME, kind);
      return null;
    }
  }

  async getTrending(niche: string): Promise<AffiliateOffer[]> {
    const offers = await this.listOffers({ niche, limit: 10 });
    return offers.map(asTrending);
  }
}
