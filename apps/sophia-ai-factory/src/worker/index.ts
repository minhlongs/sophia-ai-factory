/**
 * RaaS Gateway Worker - Edge Quota Enforcement with Overage Billing
 * @module worker/index
 */

/// <reference types="@cloudflare/workers-types" />

import { UsageEvent as WorkerUsageEvent } from './lib/usage-emitter'
import { incrementUsage } from './lib/quota-counter'
import {
  handleScheduledAlertCheck, handleAlertDispatchRequest, type AlertDispatcherConfig,
} from './lib/realtime-alert-dispatcher'
import { runMeteringReconciliation } from './lib/metering-reconciler-runner'
import { logger } from '@/lib/utils/logger-utility'
import { handleQuotaCheck, handleProxyRequest, handleOverageWebhook } from './worker-handlers'

export interface Env {
  KV_KV: KVNamespace
  USAGE_QUEUE: Queue<WorkerUsageEvent>
  R2_BUCKET: R2Bucket
  DB: D1Database
  ENVIRONMENT: string
  HARD_LIMIT_PERCENT: string
  OVERAGE_WEBHOOK_URL?: string
  NOWPAYMENTS_API_KEY?: string
  NOWPAYMENTS_IPN_SECRET?: string
  AGENCYOS_NOTIFICATION_URL: string
  AGENCYOS_WEBHOOK_SECRET: string
  AGENCYOS_ALERT_WEBHOOK_URL: string
  AGENCYOS_API_KEY: string
}

export type { WorkerUsageEvent as UsageEvent }

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), { headers: { 'Content-Type': 'application/json' } })
    }
    if (url.pathname === '/api/quota/check') return handleQuotaCheck(request, env)
    if (url.pathname.startsWith('/api/proxy/')) return handleProxyRequest(request, env, ctx)
    if (url.pathname === '/api/webhooks/overage') return handleOverageWebhook(request, env)
    if (url.pathname === '/api/alerts/dispatch') {
      const config: AlertDispatcherConfig = {
        agencyosWebhookUrl: env.AGENCYOS_ALERT_WEBHOOK_URL, agencyosApiKey: env.AGENCYOS_API_KEY,
        debounceMs: 60000, enabledThresholds: [80, 90, 100],
      }
      return handleAlertDispatchRequest(request, config, env.KV_KV, env.DB)
    }
    return new Response('Not Found', { status: 404 })
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const config: AlertDispatcherConfig = {
      agencyosWebhookUrl: env.AGENCYOS_ALERT_WEBHOOK_URL, agencyosApiKey: env.AGENCYOS_API_KEY,
      debounceMs: 60000, enabledThresholds: [80, 90, 100],
    }
    await handleScheduledAlertCheck(config, env.KV_KV, ctx, env.DB)
    if (event.cron === '0 2 * * *') {
      ctx.waitUntil(
        runMeteringReconciliation(env, ctx)
          .then(result => logger.info('[Scheduled] Reconciliation complete', { success: result.success, reportId: result.report.id, totalAmount: result.report.totalAmount }))
          .catch(error => logger.error('[Scheduled] Reconciliation failed', error instanceof Error ? error : new Error(String(error))))
      )
    }
  },

  async queue(batch: MessageBatch<WorkerUsageEvent>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const event of batch.messages.map(m => m.body)) {
      await incrementUsage(event.licenseNonce, event.service || 'default', event.overageCount, env.KV_KV)
      if (event.overageFee > 0 && env.OVERAGE_WEBHOOK_URL) {
        ctx.waitUntil(
          fetch(env.OVERAGE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) })
            .catch(() => { /* fire-and-forget */ })
        )
      }
    }
  },
}
