import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { redisHelpers } from '@/lib/clients/upstash-redis-client';
import type { HealthResponse } from '@/types/health';
import { withRateLimit } from '@/middleware/rate-limit-wrapper';

// Wrap handler with rate limiting (300 requests per minute for health checks)
export const GET = withRateLimit(async function GET(req: NextRequest) {
  try {
  const searchParams = req.nextUrl.searchParams;
  const token = searchParams.get('token');
  const authHeader = req.headers.get('authorization');

  const secret = process.env.HEALTH_CHECK_SECRET;
  let isAuthorized = !!(secret && (token === secret || authHeader === `Bearer ${secret}`));

  // Also authorize logged-in dashboard users via Better Auth session
  if (!isAuthorized) {
    try {
      const { getCurrentUserFromHeaders } = await import('@/lib/better-auth-session');
      const user = await getCurrentUserFromHeaders(req.headers);
      if (user) isAuthorized = true;
    } catch { /* session check failed */ }
  }

  // Base response
  const healthStatus: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // 1. Check Database (Supabase — used for profiles/settings, not auth)
  // Supabase failures are non-critical — app core runs on D1
  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseConfigured) {
    const supabaseStartTime = Date.now();
    try {
      const db = createServerClient();
      const { error } = await db.from('user_profiles').select('user_id').limit(1);

      if (isAuthorized) {
        healthStatus.services.supabase = {
          status: error ? 'degraded' : 'up',
          latency: Date.now() - supabaseStartTime,
          ...(error && { error: error.message }),
        };
      }
      // Don't set overall status to unhealthy — Supabase is for profiles, not core
    } catch {
      if (isAuthorized) {
        healthStatus.services.supabase = {
          status: 'degraded',
          latency: Date.now() - supabaseStartTime,
        };
      }
      // Don't degrade overall status — D1 handles core auth
    }
  } else if (isAuthorized) {
    healthStatus.services.supabase = { status: 'not_configured' };
  }

  // 2. Check Redis (Optional — only degrade if configured but failing)
  const redisConfigured = !!process.env.UPSTASH_REDIS_REST_URL;
  if (redisConfigured) {
    const redisStartTime = Date.now();
    try {
      const isRedisUp = await redisHelpers.ping();

      if (isAuthorized) {
        healthStatus.services.redis = {
          status: isRedisUp ? 'up' : 'down',
          latency: Date.now() - redisStartTime,
        };
      }

      if (!isRedisUp) {
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      healthStatus.status = 'degraded';

      if (isAuthorized) {
        healthStatus.services.redis = {
          status: 'down',
          error: errorMessage,
          latency: Date.now() - redisStartTime,
        };
      } else {
        healthStatus.services.redis = { status: 'down' };
      }
    }
  } else if (isAuthorized) {
    healthStatus.services.redis = { status: 'not_configured' };
  }

  // 3. Check Inngest (Optional — only degrade if configured but failing)
  const inngestConfigured = !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY;
  if (isAuthorized) {
      healthStatus.services.inngest = {
        status: inngestConfigured ? 'configured' : 'not_configured',
      };
  }
  // Not configured = OK (optional service), don't degrade

  // 3. Check External Services (Configuration check)
  if (isAuthorized) {
      const services = [
        { key: 'OPENROUTER_API_KEY', name: 'openrouter' },
        { key: 'ELEVENLABS_API_KEY', name: 'elevenlabs' },
        { key: 'HEYGEN_API_KEY', name: 'heygen' },
        { key: 'TELEGRAM_BOT_TOKEN', name: 'telegram' },
      ];

      services.forEach((service) => {
        const isConfigured = !!process.env[service.key];
        healthStatus.services[service.name] = {
          status: isConfigured ? 'configured' : 'missing_config',
        };
      });
  }

  // Return limited info if not authorized
  if (!isAuthorized) {
      const publicResponse: Record<string, unknown> = {
          status: healthStatus.status,
          timestamp: healthStatus.timestamp,
      };
      // Show basic service status even publicly (no error details)
      if (healthStatus.status !== 'healthy') {
          publicResponse.hint = healthStatus.status === 'degraded'
              ? 'Some configured services are temporarily unavailable'
              : 'Service disruption detected';
      }
      return NextResponse.json(publicResponse, {
        status: healthStatus.status === 'unhealthy' ? 503 : 200,
      });
  }

  return NextResponse.json(healthStatus, {
    status: healthStatus.status === 'unhealthy' ? 503 : 200,
  });
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Health check failed' },
      { status: 500 }
    );
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 300 } });
