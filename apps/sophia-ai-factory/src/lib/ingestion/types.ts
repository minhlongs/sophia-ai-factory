export type NetworkId = 'clickbank' | 'shareasale' | 'amazon'

export interface RawProduct {
  external_id: string
  network_id: NetworkId
  title: string
  description?: string
  affiliate_link: string
  thumbnail_url?: string
  price_usd?: number
  commission_rate?: number // 0-1 (e.g., 0.75 for 75%)
  avg_earnings_usd?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_metrics: Record<string, any>
  category_id?: number // Internal category ID if known, or network specific ID to be mapped
  network_category?: string
}

export interface IngestionResult {
  total: number
  processed: number
  skipped: number
  failed: number
  errors: string[]
}

export interface IngestionAdapter {
  networkId: NetworkId
  fetchProducts(): Promise<RawProduct[]>
}

export interface AdapterConfig {
  apiKey?: string
  apiSecret?: string
  affiliateId?: string
}
