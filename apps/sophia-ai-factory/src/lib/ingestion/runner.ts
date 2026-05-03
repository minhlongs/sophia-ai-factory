import { ClickbankAdapter } from './adapters/clickbank-adapter'
import { ShareasaleAdapter } from './adapters/shareasale-adapter'
import type { IngestionResult } from './types'
import { toError } from '@/seed/utils/to-error'

export async function runIngestion(networks: string[] = ['clickbank', 'shareasale']): Promise<Record<string, IngestionResult>> {
  const results: Record<string, IngestionResult> = {}

  if (networks.includes('clickbank')) {
    const cbAdapter = new ClickbankAdapter()
    try {
      const products = await cbAdapter.fetchProducts()
      results['clickbank'] = await cbAdapter.upsertProducts(products)
    } catch (error) {
      results['clickbank'] = {
        total: 0, processed: 0, skipped: 0, failed: 0,
        errors: [toError(error).message]
      }
    }
  }

  if (networks.includes('shareasale')) {
    const sasAdapter = new ShareasaleAdapter()
    try {
      const products = await sasAdapter.fetchProducts()
      results['shareasale'] = await sasAdapter.upsertProducts(products)
    } catch (error) {
      results['shareasale'] = {
        total: 0, processed: 0, skipped: 0, failed: 0,
        errors: [toError(error).message]
      }
    }
  }

  return results
}
