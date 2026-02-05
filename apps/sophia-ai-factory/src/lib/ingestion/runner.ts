import { ClickbankAdapter } from './adapters/clickbank-adapter'
import { ShareasaleAdapter } from './adapters/shareasale-adapter'
import type { IngestionResult } from './types'

export async function runIngestion(networks: string[] = ['clickbank', 'shareasale']): Promise<Record<string, IngestionResult>> {
  const results: Record<string, IngestionResult> = {}

  if (networks.includes('clickbank')) {
    console.log('Starting ClickBank ingestion...')
    const cbAdapter = new ClickbankAdapter()
    try {
      const products = await cbAdapter.fetchProducts()
      results['clickbank'] = await cbAdapter.upsertProducts(products)
    } catch (error) {
      console.error('ClickBank ingestion failed:', error)
      results['clickbank'] = {
        total: 0, processed: 0, skipped: 0, failed: 0,
        errors: [(error as Error).message]
      }
    }
  }

  if (networks.includes('shareasale')) {
    console.log('Starting ShareASale ingestion...')
    const sasAdapter = new ShareasaleAdapter()
    try {
      const products = await sasAdapter.fetchProducts()
      results['shareasale'] = await sasAdapter.upsertProducts(products)
    } catch (error) {
      console.error('ShareASale ingestion failed:', error)
      results['shareasale'] = {
        total: 0, processed: 0, skipped: 0, failed: 0,
        errors: [(error as Error).message]
      }
    }
  }

  return results
}
