/**
 * Amazon Product Advertising API v5 Adapter
 *
 * Searches and fetches Amazon products via PA-API v5.
 * Auth: AMAZON_ACCESS_KEY + AMAZON_SECRET_KEY + AMAZON_PARTNER_TAG.
 * Request signing uses AWS SigV4 (HMAC-SHA256).
 * Falls back to mock fixtures when env vars are absent.
 *
 * PA-API docs: https://webservices.amazon.com/paapi5/documentation
 *
 * @module affiliates/providers/amazon
 */

import type { OfferProvider, AffiliateOffer, ListOffersOpts } from '../provider-interface'
import { asTrending } from '../provider-interface'

const NETWORK_SLUG = 'amazon'
const PA_API_HOST = 'webservices.amazon.com'
const PA_API_REGION = 'us-east-1'
const SERVICE = 'ProductAdvertisingAPI'

/** AWS SigV4 signing helper for PA-API */
async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  // For Uint8Array, extract the exact slice using byteOffset so subarray() results sign
  // the correct bytes (avoids the byteOffset bug from `key.buffer as ArrayBuffer`).
  const keyBuf: BufferSource = key instanceof ArrayBuffer
    ? key
    : new Uint8Array(key.buffer instanceof ArrayBuffer ? key.buffer : (key.buffer as unknown as ArrayBuffer), key.byteOffset, key.byteLength)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return crypto.subtle.sign('HMAC', keyMaterial, new TextEncoder().encode(data))
}

async function getSigningKey(
  secretKey: string,
  date: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`), date)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function signPaApiRequest(
  accessKey: string,
  secretKey: string,
  body: string
): Promise<Record<string, string>> {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)

  const bodyHash = bufToHex(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
  )
  const canonicalHeaders =
    `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${PA_API_HOST}\nx-amz-date:${amzDate}\nx-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target'
  const canonicalRequest = [
    'POST', '/paapi5/searchitems', '',
    canonicalHeaders, signedHeaders, bodyHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${PA_API_REGION}/${SERVICE}/aws4_request`
  const canonicalHash = bufToHex(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))
  )
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalHash}`
  const signingKey = await getSigningKey(secretKey, dateStamp, PA_API_REGION, SERVICE)
  const signature = bufToHex(await hmacSha256(signingKey, stringToSign))

  return {
    'Content-Encoding': 'amz-1.0',
    'Content-Type': 'application/json; charset=utf-8',
    'x-amz-date': amzDate,
    'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

interface AmazonItem {
  ASIN: string
  ItemInfo?: { Title?: { DisplayValue?: string }; Features?: { DisplayValues?: string[] } }
  Images?: { Primary?: { Medium?: { URL?: string } } }
  Offers?: { Listings?: { Price?: { Amount?: number } }[] }
  DetailPageURL?: string
  BrowseNodeInfo?: { BrowseNodes?: { DisplayName?: string }[] }
}

interface PaApiResponse {
  SearchResult?: { Items?: AmazonItem[] }
}

function mapItem(item: AmazonItem, partnerTag: string): AffiliateOffer {
  const title = item.ItemInfo?.Title?.DisplayValue ?? item.ASIN
  const features = item.ItemInfo?.Features?.DisplayValues ?? []
  return {
    externalId: item.ASIN,
    title,
    description: features.slice(0, 2).join('. '),
    imageUrl: item.Images?.Primary?.Medium?.URL ?? '',
    productUrl: `https://www.amazon.com/dp/${item.ASIN}?tag=${partnerTag}`,
    commissionPct: 4,
    commissionFixedUsd: null,
    niche: item.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName ?? 'general',
    language: 'en',
    region: 'US',
    isTrending: false,
  }
}

function mockOffers(): AffiliateOffer[] {
  return [
    {
      externalId: 'B0AMZOCK01',
      title: 'Amazon Best Seller Electronics (Mock)',
      description: 'Mock product fixture for PA-API v5 adapter',
      imageUrl: 'https://placehold.co/400x400?text=Amazon',
      productUrl: 'https://www.amazon.com/dp/B0AMZOCK01?tag=mock-20',
      commissionPct: 4,
      commissionFixedUsd: null,
      niche: 'electronics',
      language: 'en',
      region: 'US',
      isTrending: false,
    },
  ]
}

export class AmazonProvider implements OfferProvider {
  readonly networkSlug = NETWORK_SLUG

  private get accessKey(): string | undefined { return process.env.AMAZON_ACCESS_KEY }
  private get secretKey(): string | undefined { return process.env.AMAZON_SECRET_KEY }
  private get partnerTag(): string | undefined { return process.env.AMAZON_PARTNER_TAG }

  async listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]> {
    if (!this.accessKey || !this.secretKey || !this.partnerTag) return mockOffers()
    try {
      const body = JSON.stringify({
        Keywords: opts?.niche ?? 'bestseller',
        PartnerTag: this.partnerTag,
        PartnerType: 'Associates',
        Resources: ['ItemInfo.Title', 'ItemInfo.Features', 'Images.Primary.Medium', 'Offers.Listings.Price', 'BrowseNodeInfo.BrowseNodes'],
        SearchIndex: 'All',
        ItemCount: Math.min(opts?.limit ?? 10, 10),
      })
      const headers = await signPaApiRequest(this.accessKey, this.secretKey, body)
      const res = await fetch(`https://${PA_API_HOST}/paapi5/searchitems`, {
        method: 'POST', headers, body,
      })
      if (!res.ok) return mockOffers()
      const json = await res.json() as PaApiResponse
      return (json.SearchResult?.Items ?? []).map(i => mapItem(i, this.partnerTag!))
    } catch {
      return mockOffers()
    }
  }

  async getOffer(externalId: string): Promise<AffiliateOffer | null> {
    if (!this.accessKey || !this.secretKey || !this.partnerTag) return mockOffers()[0]
    try {
      const body = JSON.stringify({
        ItemIds: [externalId],
        PartnerTag: this.partnerTag,
        PartnerType: 'Associates',
        Resources: ['ItemInfo.Title', 'Images.Primary.Medium', 'Offers.Listings.Price'],
      })
      const headers = await signPaApiRequest(this.accessKey, this.secretKey, body)
      const res = await fetch(`https://${PA_API_HOST}/paapi5/getitems`, {
        method: 'POST', headers, body,
      })
      if (!res.ok) return null
      const json = await res.json() as { ItemsResult?: { Items?: AmazonItem[] } }
      const item = json.ItemsResult?.Items?.[0]
      return item ? mapItem(item, this.partnerTag) : null
    } catch {
      return null
    }
  }

  async getTrending(niche: string): Promise<AffiliateOffer[]> {
    const offers = await this.listOffers({ niche, limit: 10 })
    return offers.map(asTrending)
  }
}
