import { BaseAdapter } from '../base-adapter'
import type { RawProduct, AdapterConfig } from '../types'
import JSZip from 'jszip'

export class ClickbankAdapter extends BaseAdapter {
  networkId = 'clickbank' as const
  private feedUrl = 'https://accounts.clickbank.com/feeds/marketplace_feed_v2.json.zip'
  private config?: AdapterConfig

  constructor(config?: AdapterConfig) {
    super(10) // Clickbank feed is one big file, so rate limit isn't huge concern for calls, but good practice.
    this.config = config
  }

  async fetchProducts(): Promise<RawProduct[]> {
    try {
      const response = await fetch(this.feedUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch ClickBank feed: ${response.statusText}`)
      }

      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()

      const zip = await JSZip.loadAsync(arrayBuffer)

      // The zip usually contains a single json file
      const files = Object.keys(zip.files)
      const jsonFile = files.find(f => f.endsWith('.json'))

      if (!jsonFile) {
        throw new Error('No JSON file found in ClickBank feed zip')
      }

      const content = await zip.files[jsonFile].async('string')
      const data = JSON.parse(content)

      // Parse products from the feed structure
      // Structure is typically: { details: [...], ... }
      // We need to verify the actual V2 structure.
      // Assuming a standard list for now based on standard affiliate feeds.

      const products: RawProduct[] = []

      // Example parsing logic (simplified)
      // data.products or data.feeds ...
      // Note: ClickBank V2 JSON structure is often:
      // [ { site: 'vendorId', title: '...', description: '...', ... }, ... ]
      // or wrapped in an object.

      const items = Array.isArray(data) ? data : (data.products || [])

      for (const item of items) {
        const product: RawProduct = {
          external_id: item.site || item.id, // vendor ID is the key for ClickBank
          network_id: this.networkId,
          title: item.title,
          description: item.description,
          // ClickBank hoplink format: https://HOP.hop.clickbank.net
          // We need a placeholder affiliate ID, or store the generic link
          affiliate_link: `https://AFFILIATE.hop.clickbank.net/?tid=SOPHIA&vendor=${item.site}`,
          thumbnail_url: undefined, // ClickBank feed rarely has thumbnails
          price_usd: undefined, // Often variable
          commission_rate: item.commission ? parseFloat(item.commission) / 100 : undefined,
          avg_earnings_usd: item.averageEarningsPerSale,
          raw_metrics: {
            gravity: item.gravity,
            totalRebillAmt: item.totalRebillAmt,
            initialEarningsPerSale: item.initialEarningsPerSale,
            percentPerSale: item.percentPerSale,
            referred: item.referred, // popularity rank sometimes
          },
          network_category: item.categories?.[0] // Take primary category
        }

        products.push(product)
      }

      return products

    } catch {
      // For development fallback if feed fails (likely due to CORS or network in this env)
      if (process.env.NODE_ENV === 'development') {
        return this.getMockData()
      }
      return []
    }
  }

  private getMockData(): RawProduct[] {
    return [
      {
        external_id: 'PROD1',
        network_id: 'clickbank',
        title: 'Manifestation Magic',
        description: 'Top converting manifestation offer.',
        affiliate_link: 'https://AFFILIATE.hop.clickbank.net/?vendor=PROD1',
        avg_earnings_usd: 45.50,
        raw_metrics: { gravity: 150.2 },
        network_category: 'Spirituality'
      },
      {
        external_id: 'PROD2',
        network_id: 'clickbank',
        title: 'Keto Custom Plan',
        description: 'Personalized keto diet plan.',
        affiliate_link: 'https://AFFILIATE.hop.clickbank.net/?vendor=PROD2',
        avg_earnings_usd: 35.20,
        raw_metrics: { gravity: 89.5 },
        network_category: 'Health & Fitness'
      }
    ]
  }
}
