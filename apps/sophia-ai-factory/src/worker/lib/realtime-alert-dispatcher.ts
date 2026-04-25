/**
 * RaaS Gateway Worker - Alert Dispatcher
 * Polls usage_events via D1, detects threshold breaches, dispatches webhook alerts.
 * @module worker/realtime-alert-dispatcher
 */

import { ExecutionContext } from '@cloudflare/workers-types'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import { handleUsageEvent, type UsageEvent } from './realtime-alert-dispatcher-event-handler'

export interface AlertDispatcherConfig {
  supabaseUrl: string
  supabaseServiceKey: string
  agencyosWebhookUrl: string
  agencyosApiKey: string
  debounceMs: number
  enabledThresholds: number[]
}

export async function initRealtimeAlerts(config: AlertDispatcherConfig, kv: KVNamespace | null, ctx: ExecutionContext): Promise<void> {
  logger.info('[Alert Dispatcher] Initialized (polling mode via scheduled worker)', { agencyosUrl: config.agencyosWebhookUrl, debounceMs: config.debounceMs })
}

export async function handleScheduledAlertCheck(config: AlertDispatcherConfig, kv: KVNamespace | null, ctx: ExecutionContext, db: D1Database): Promise<void> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
    const { results: recentEvents } = await db.prepare(`SELECT * FROM usage_events WHERE created_at >= ? LIMIT 100`).bind(oneMinuteAgo).all<UsageEvent>()
    if (!recentEvents?.length) return
    for (const event of recentEvents) { ctx.waitUntil(handleUsageEvent(event, config, kv, ctx, db)) }
    logger.info('[Alert Dispatcher] Scheduled check completed', { eventsProcessed: recentEvents.length })
  } catch (error) {
    logger.error('[Alert Dispatcher] Scheduled check error', toError(error))
  }
}

export async function handleAlertDispatchRequest(request: Request, config: AlertDispatcherConfig, kv: KVNamespace | null, db: D1Database): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const body = await request.json() as UsageEvent
    if (!body.user_id || !body.license_nonce) return new Response('Missing required fields', { status: 400 })
    await handleUsageEvent(body, config, kv, {} as ExecutionContext, db)
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    logger.error('[Alert Dispatcher] Request error', toError(error))
    return new Response('Internal error', { status: 500 })
  }
}
