import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { HealthResponse } from '@/types/health';

export async function GET() {
  const healthStatus: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // 1. Check Supabase
  const supabaseStartTime = Date.now();
  try {
    const supabase = await createClient();
    // Simple query to check connection - fetching user session or a lightweight query
    // Since we might not have a public table guaranteed, checking auth session is usually safe enough
    // to check connection to Auth service at least.
    // Or we can just check if the client initializes and maybe try to get the server configuration or health if exposed.
    // For now, let's try a simple auth check which hits the database/auth service.
    const { error } = await supabase.auth.getSession();

    if (error) {
       // If session fetch fails (even if no session), it usually returns data: { session: null }, not an error.
       // An actual error usually means connection issues.
       throw error;
    }

    healthStatus.services.supabase = {
      status: 'up',
      latency: Date.now() - supabaseStartTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    healthStatus.status = 'degraded';
    healthStatus.services.supabase = {
      status: 'down',
      error: errorMessage,
      latency: Date.now() - supabaseStartTime,
    };
  }

  // 2. Check Inngest (Configuration check)
  const inngestConfigured = !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY;
  healthStatus.services.inngest = {
    status: inngestConfigured ? 'configured' : 'missing_config',
  };
  if (!inngestConfigured) healthStatus.status = 'degraded';

  // 3. Check External Services (Configuration check)
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
    // Note: Missing optional services might not downgrade overall health to 'unhealthy'
    // unless they are critical. For now, we'll keep overall status as is or mark 'degraded'
    // if critical ones are missing. Let's assume they are critical for "Production Verification".
    if (!isConfigured) {
        // We won't change global status for these yet, just report status
    }
  });

  return NextResponse.json(healthStatus, {
    status: healthStatus.status === 'unhealthy' ? 503 : 200,
  });
}
