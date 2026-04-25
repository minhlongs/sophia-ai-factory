/**
 * KV-based debounce helpers for realtime alert dispatcher
 * @module worker/realtime-alert-dispatcher-kv
 */

import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'

interface DebounceState { lastAlertTime: number; threshold: number }

export async function isDebounced(kv: KVNamespace | null, userId: string, licenseNonce: string, threshold: number, debounceMs: number): Promise<boolean> {
  if (!kv) return false
  try {
    const key = `alert_debounce:${userId}:${licenseNonce}:${threshold}`
    const cached = await kv.get(key)
    if (cached) {
      const state = JSON.parse(cached) as DebounceState
      return (Date.now() - state.lastAlertTime) < debounceMs
    }
  } catch (error) {
    logger.error('[Alert Dispatcher] Debounce check error', toError(error))
  }
  return false
}

export async function markAlertSent(kv: KVNamespace | null, userId: string, licenseNonce: string, threshold: number, ttlSeconds = 300): Promise<void> {
  if (!kv) return
  try {
    const key = `alert_debounce:${userId}:${licenseNonce}:${threshold}`
    const state: DebounceState = { lastAlertTime: Date.now(), threshold }
    await kv.put(key, JSON.stringify(state), { expirationTtl: ttlSeconds })
  } catch (error) {
    logger.error('[Alert Dispatcher] Mark sent error', toError(error))
  }
}
