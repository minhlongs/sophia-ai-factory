import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { HealthResponse } from '@/types/health';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const token = searchParams.get('token');
  const authHeader = req.headers.get('authorization');

  const secret = process.env.HEALTH_CHECK_SECRET;
  const isAuthorized = secret && (token === secret || authHeader === `Bearer ${secret}`);

  // Base response
  const healthStatus: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // 1. Check Supabase (Critical)
  const supabaseStartTime = Date.now();
  try {
    const supabase = await createClient();
    // Simple query to check connection
    const { error } = await supabase.auth.getSession();

    if (error) throw error;

    if (isAuthorized) {
        healthStatus.services.supabase = {
          status: 'up',
          latency: Date.now() - supabaseStartTime,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    healthStatus.status = 'unhealthy';

    if (isAuthorized) {
        healthStatus.services.supabase = {
            status: 'down',
            error: errorMessage,
            latency: Date.now() - supabaseStartTime,
        };
    } else {
        // Publicly just show something is wrong without details
        healthStatus.services.supabase = { status: 'down' };
    }
  }

  // 2. Check Inngest (Configuration check)
  const inngestConfigured = !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY;
  if (isAuthorized) {
      healthStatus.services.inngest = {
        status: inngestConfigured ? 'configured' : 'missing_config',
      };
  }

  if (!inngestConfigured) healthStatus.status = 'degraded';

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
  if (!isAuthorized && healthStatus.status !== 'healthy') {
      // Obscure details for public
      return NextResponse.json({
          status: healthStatus.status,
          timestamp: healthStatus.timestamp
      }, {
        status: healthStatus.status === 'unhealthy' ? 503 : 200,
      });
  }

  return NextResponse.json(healthStatus, {
    status: healthStatus.status === 'unhealthy' ? 503 : 200,
  });
}
