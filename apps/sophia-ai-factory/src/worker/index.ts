/**
 * RaaS Gateway Worker - Edge Quota Enforcement with Overage Billing
 *
 * Cloudflare Worker entry point for real-time quota enforcement
 * at the edge before requests hit origin servers.
 *
 * Features:
 * - JWT authentication for RaaS API keys
 * - Tier-based quota limits (BASIC/PREMIUM/ENTERPRISE)
 * - Overage fee calculation
 * - Queue-based async usage event processing
 * - Standardized 429 responses with retry headers
 * - Stripe webhook integration for dunning workflow (Phase 6)
 * - Realtime alert dispatcher for AgencyOS dashboard (Phase 7.3)
 */

import { verifyJwt } from './lib/auth-middleware';
import { checkQuota, incrementUsage, getCurrentUsage } from './lib/quota-counter';
import { calculateOverage, getTierPricing } from './lib/overage-calculator';
import { createUsageEvent, UsageEvent as WorkerUsageEvent } from './lib/usage-emitter';
import { buildQuotaExceededResponse, buildQuotaInfoHeaders } from './lib/quota-response';
// Stripe webhook removed — NOWPayments IPN handles payments
// RaaS Authentication & Feature Access Control
import {
  raasAuthMiddleware,
  createFeatureGuard,
  getRequiredFeature,
  checkFeatureAccess,
  type AuthContext,
} from './middleware/raas-auth-middleware';
import { isTierEligibleForOverage } from './middleware/feature-entitlement';
// Phase 7.3: Realtime Alert Dispatcher
import {
  handleScheduledAlertCheck,
  handleAlertDispatchRequest,
  type AlertDispatcherConfig,
} from './lib/realtime-alert-dispatcher';
// Phase 6: Metering Reconciliation Runner
import {
  runMeteringReconciliation,
} from './lib/metering-reconciler-runner';
import { logger } from '@/lib/utils/logger-utility';

// Environment bindings
export interface Env {
  KV_KV: KVNamespace;
  USAGE_QUEUE: Queue<WorkerUsageEvent>;
  R2_BUCKET: R2Bucket;  // Phase 6: R2 storage for reconciliation reports
  ENVIRONMENT: string;
  HARD_LIMIT_PERCENT: string;
  OVERAGE_WEBHOOK_URL?: string;
  // NOWPayments (payment provider)
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_IPN_SECRET?: string;
  AGENCYOS_NOTIFICATION_URL: string;
  AGENCYOS_WEBHOOK_SECRET: string;
  // Phase 7.3: Realtime Alert Dispatcher config
  AGENCYOS_ALERT_WEBHOOK_URL: string;
  AGENCYOS_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

// Re-export usage event type for queue consumer
export type { WorkerUsageEvent as UsageEvent };

// Response types
interface QuotaResponse {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetDate: string;
  overage?: {
    count: number;
    fee: number;
    isOverHardLimit: boolean;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Quota check endpoint
    if (url.pathname === '/api/quota/check') {
      return handleQuotaCheck(request, env);
    }

    // Quota enforcement proxy endpoint
    if (url.pathname.startsWith('/api/proxy/')) {
      return handleProxyRequest(request, env, ctx);
    }

    // Overage webhook endpoint (for Next.js to push billing events)
    if (url.pathname === '/api/webhooks/overage') {
      return handleOverageWebhook(request, env);
    }

    // Phase 7.3: Realtime alert dispatch endpoint (for testing)
    if (url.pathname === '/api/alerts/dispatch') {
      const config: AlertDispatcherConfig = {
        supabaseUrl: env.SUPABASE_URL,
        supabaseServiceKey: env.SUPABASE_SERVICE_KEY,
        agencyosWebhookUrl: env.AGENCYOS_ALERT_WEBHOOK_URL,
        agencyosApiKey: env.AGENCYOS_API_KEY,
        debounceMs: 60000,
        enabledThresholds: [80, 90, 100],
      };
      return handleAlertDispatchRequest(request, config, env.KV_KV);
    }

    return new Response('Not Found', { status: 404 });
  },

  /**
   * Scheduled handler - runs every minute for alerts + daily 02:00 UTC for reconciliation
   * Phase 7.3: Realtime alert monitoring via scheduled polling
   * Phase 6: Daily metering reconciliation at 02:00 UTC (cron: 0 2 * * *)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const config: AlertDispatcherConfig = {
      supabaseUrl: env.SUPABASE_URL,
      supabaseServiceKey: env.SUPABASE_SERVICE_KEY,
      agencyosWebhookUrl: env.AGENCYOS_ALERT_WEBHOOK_URL,
      agencyosApiKey: env.AGENCYOS_API_KEY,
      debounceMs: 60000,
      enabledThresholds: [80, 90, 100],
    };

    // Run alert checks every minute
    await handleScheduledAlertCheck(config, env.KV_KV, ctx);

    // Run daily reconciliation at 02:00 UTC (cron: 0 2 * * *)
    if (event.cron === '0 2 * * *') {
      ctx.waitUntil(
        runMeteringReconciliation(env, ctx)
          .then((result) => {
            logger.info('[Scheduled] Reconciliation complete', {
              success: result.success,
              reportId: result.report.id,
              totalAmount: result.report.totalAmount,
            });
          })
          .catch((error) => {
            logger.error('[Scheduled] Reconciliation failed', error instanceof Error ? error : new Error(String(error)));
          })
      );
    }
  },

  /**
   * Queue consumer - processes batched usage events
   * Updates KV counters and calculates overage fees
   */
  async queue(batch: MessageBatch<WorkerUsageEvent>, env: Env, ctx: ExecutionContext): Promise<void> {
    const events = batch.messages.map(msg => msg.body);

    // Process each event in batch
    for (const event of events) {
      // Update KV counter
      await incrementUsage(event.licenseNonce, event.service || 'default', event.overageCount, env.KV_KV);

      // Log overage for billing (if over base limit)
      if (event.overageFee > 0 && env.OVERAGE_WEBHOOK_URL) {
        // Forward to webhook URL for persistent storage
        ctx.waitUntil(
          fetch(env.OVERAGE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
          }).catch(() => { /* Ignore errors in background */ })
        );
      }
    }
  }
};

/**
 * Handle quota check API endpoint
 */
async function handleQuotaCheck(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const { apiKey, service = 'default' } = body;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current usage
    const currentUsage = await getCurrentUsage(apiKey, service, env.KV_KV);

    // Get tier from KV
    const tierKey = `tier:${apiKey}`;
    const tier = await env.KV_KV.get(tierKey) || 'BASIC';

    // Calculate overage
    const overage = calculateOverage(currentUsage, tier);

    // Build response
    const response: QuotaResponse = {
      allowed: !overage.isOverHardLimit,
      remaining: overage.remaining,
      limit: overage.baseLimit,
      resetDate: new Date(Date.now() + 2592000000).toISOString()
    };

    if (overage.overageCount > 0) {
      response.overage = {
        count: overage.overageCount,
        fee: overage.overageFee,
        isOverHardLimit: overage.isOverHardLimit
      };
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle proxy request with quota enforcement and feature-level access control
 */
async function handleProxyRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Step 1: RaaS Authentication (supports both API key and JWT)
  const authResponse = await raasAuthMiddleware(request, env, ctx);
  if (authResponse) {
    return authResponse;
  }

  // Get auth context from environment
  const authContext = (env as any).__authContext as AuthContext | undefined;
  if (!authContext) {
    return new Response(JSON.stringify({ error: 'Authentication context missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Step 2: Get required feature for this endpoint
  const url = new URL(request.url);
  const service = url.pathname.replace('/api/proxy/', '');
  const requiredFeature = getRequiredFeature(`/api/proxy/${service}`);

  // Step 3: Check feature access if required
  if (requiredFeature) {
    const featureResult = await checkFeatureAccess(requiredFeature, authContext);
    if (!featureResult.allowed) {
      return new Response(JSON.stringify({
        error: 'Feature access denied',
        reason: featureResult.reason,
        feature: requiredFeature,
        tier: authContext.tier,
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Feature-Required': requiredFeature,
        }
      });
    }
  }

  // Step 4: Subscription status from auth context (tier set by NOWPayments IPN)
  const isPaid = authContext.is_paid ?? true;

  // Step 5: Check quota and calculate overage
  const apiKey = authContext.userId;
  const tier = authContext.tier || 'BASIC';

  // Get current usage
  const currentUsage = await getCurrentUsage(apiKey, service, env.KV_KV);

  // Calculate overage
  const overage = calculateOverage(currentUsage, tier);

  // Check if over hard limit - block request
  if (overage.isOverHardLimit) {
    return buildQuotaExceededResponse(overage);
  }

  // Check overage eligibility for paid tiers
  if (overage.overageCount > 0 && !isTierEligibleForOverage(tier)) {
    return new Response(JSON.stringify({
      error: 'Quota exceeded',
      message: `You have exceeded your ${tier} tier quota. Please upgrade to continue.`,
      remaining: 0,
      limit: overage.baseLimit,
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '3600',
      }
    });
  }

  // Increment usage in KV (atomic operation)
  const newUsage = await incrementUsage(apiKey, service, 1, env.KV_KV);

  // Recalculate overage after increment
  const updatedOverage = calculateOverage(newUsage, tier);

  // If now over limit (but not hard limit), allow but charge overage
  if (updatedOverage.overageCount > 0 && !updatedOverage.isOverHardLimit) {
    // Create usage event for billing
    const usageEvent = createUsageEvent(
      apiKey,
      authContext.userId,
      tier,
      newUsage,
      service
    );

    // Queue for async billing processing
    ctx.waitUntil(env.USAGE_QUEUE.send(usageEvent));
  }

  // Forward request to origin
  const originUrl = new URL(url.pathname.replace('/api/proxy', ''), 'https://origin.example.com');
  const originRequest = new Request(originUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  const response = await fetch(originRequest);

  // Add quota info headers to response
  const quotaHeaders = buildQuotaInfoHeaders(updatedOverage);
  const responseHeaders = new Headers(response.headers);

  // Merge quota headers into response
  quotaHeaders.forEach((value, key) => {
    responseHeaders.set(key, value);
  });

  // Add feature entitlement header for client debugging
  if (requiredFeature) {
    responseHeaders.set('X-Feature-Granted', requiredFeature);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders
  });
}

/**
 * Handle overage webhook from Next.js
 * Receives billing events for persistent storage
 */
async function handleOverageWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await request.text();
    const event: WorkerUsageEvent = JSON.parse(body);

    // Validate required fields
    if (!event.licenseNonce || !event.userId || !event.idempotencyKey) {
      return new Response(JSON.stringify({ error: 'Invalid event format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Queue event for processing
    await env.USAGE_QUEUE.send(event);

    return new Response(JSON.stringify({ received: true, eventId: event.idempotencyKey }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
