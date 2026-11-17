import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngestionResult } from '@/land/ingestion/types'
import { NextRequest } from 'next/server'

vi.mock('@/land/ingestion/runner', () => ({ runIngestion: vi.fn() }))
vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (request: Request) => Promise<Response>) => handler,
}))
import { runIngestion } from '@/land/ingestion/runner'
import { POST } from './route'

const ok: IngestionResult = { total: 1, processed: 1, skipped: 0, failed: 0, errors: [] }
const failed: IngestionResult = { total: 0, processed: 0, skipped: 0, failed: 0, errors: ['network unavailable'] }

async function trigger(results: Record<string, IngestionResult>) {
  vi.mocked(runIngestion).mockResolvedValue(results)
  return POST(new NextRequest('https://example.test/api/ingestion/trigger', {
    method: 'POST',
    headers: { authorization: 'Bearer fixture-secret', 'content-type': 'application/json' },
    body: JSON.stringify({ networks: ['clickbank', 'shareasale'] }),
  }))
}

beforeEach(() => { vi.stubEnv('CRON_SECRET', 'fixture-secret') })
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('ingestion trigger result policy', () => {
  it('returns non-2xx when all network attempts return errors', async () => {
    const response = await trigger({ clickbank: failed, shareasale: failed })
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ success: false, partial: false })
  })

  it('preserves completed sibling results but rejects partial failure', async () => {
    const results = { clickbank: ok, shareasale: failed }
    const response = await trigger(results)
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ success: false, partial: true, results })
  })

  it('rejects failed records even without error strings', async () => {
    const response = await trigger({ clickbank: { ...ok, failed: 1 } })
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ success: false, partial: true })
  })

  it('returns success for completed ingestion including empty successful feeds', async () => {
    const response = await trigger({ clickbank: ok, shareasale: { ...ok, total: 0, processed: 0 } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, partial: false })
  })
})
