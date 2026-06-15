/**
 * Batch buffer for Overage Event Logger
 * @module quota/overage-logger-buffer
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { OverageEventInput } from './overage-logger-types'

class OverageEventBuffer {
  private buffer: OverageEventInput[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private readonly MAX_BUFFER_SIZE = 10
  private readonly FLUSH_INTERVAL_MS = 5000

  async add(event: OverageEventInput): Promise<void> {
    this.buffer.push(event)
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      await this.flush()
      return
    }
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush().catch(err => logger.error('[Overage Logger] Buffered flush error', err))
        this.flushTimer = null
      }, this.FLUSH_INTERVAL_MS)
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    const events = [...this.buffer]
    this.buffer = []
    try {
      const db = createServerClient()
      const { error } = await (db as unknown as { from: (t: string) => { insert: (rows: unknown[]) => Promise<{ error: unknown }> } })
        .from('overage_events').insert(events.map(event => ({
          user_id: event.userId, license_nonce: event.licenseNonce,
          exceeded_type: event.exceededType, exceeded_limit: event.exceededLimit,
          exceeded_current: event.exceededCurrent, exceeded_by: event.exceededBy,
          requested_credits: event.requestedCredits, endpoint: event.endpoint,
          service_name: event.service, action: event.action,
          tier_at_exceeded: event.tier, ip_address: event.ipAddress,
          user_agent: event.userAgent, billable: false,
        })))
      if (error) throw error
      logger.info('[Overage Logger] Flushed batch', { count: events.length })
    } catch (error) {
      logger.error('[Overage Logger] Batch flush failed', toError(error))
      if (this.buffer.length < 100) this.buffer.unshift(...events)
      else logger.error('[Overage Logger] Dropped events due to buffer overflow')
    }
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null }
    await this.flush()
  }
}

let globalBuffer: OverageEventBuffer | null = null

export function getBuffer(): OverageEventBuffer {
  if (!globalBuffer) globalBuffer = new OverageEventBuffer()
  return globalBuffer
}

/**
 * Register Node.js shutdown hooks for the overage buffer.
 *
 * Mirror of `usage-metering/batch-buffer.installShutdownHandlers()` —
 * see that file's comment for the Edge Runtime rationale. Caller:
 * `instrumentation.ts` under NEXT_RUNTIME==='nodejs'.
 *
 * @edge-runtime-allowed: process.on hooks are gated inside an exported
 * function so the module bundles safely for Edge; only the Node entry
 * (instrumentation.ts) actually invokes them.
 */
export function installShutdownHandlers(): void {
  if (typeof process === 'undefined' || typeof process.on !== 'function') {
    return
  }
  process.on('SIGTERM', async () => { if (globalBuffer) await globalBuffer.destroy() })
  process.on('SIGINT', async () => { if (globalBuffer) await globalBuffer.destroy() })
}
