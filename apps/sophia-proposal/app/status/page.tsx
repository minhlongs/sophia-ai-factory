/**
 * /status — Service configuration dashboard.
 *
 * Server component, no auth required (public route).
 * Protected by ?key=<CRON_SECRET> when CRON_SECRET is set.
 * Shows which services are configured vs missing.
 */

import { headers } from 'next/headers';

interface ServiceStatus {
  name: string;
  description: string;
  configured: boolean;
  hint: string;
}

function getServiceStatuses(): ServiceStatus[] {
  return [
    {
      name: 'AI Engine (Claude)',
      description: 'Proposal generation, content AI',
      configured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.LLM_BASE_URL),
      hint: 'Set ANTHROPIC_API_KEY or LLM_BASE_URL + LLM_API_KEY',
    },
    {
      name: 'Email (Resend)',
      description: 'Outreach emails, magic links',
      configured: Boolean(process.env.RESEND_API_KEY),
      hint: 'Set RESEND_API_KEY — emails run in dry-run mode until configured',
    },
    {
      name: 'Auth (JWT)',
      description: 'User login, session tokens',
      configured: Boolean(process.env.JWT_SECRET),
      hint: 'Set JWT_SECRET — generate with: openssl rand -hex 32',
    },
    {
      name: 'Billing (Polar)',
      description: 'Subscriptions, checkouts',
      configured: Boolean(process.env.POLAR_ACCESS_TOKEN || process.env.POLAR_API_KEY),
      hint: 'Set POLAR_ACCESS_TOKEN from polar.sh dashboard',
    },
    {
      name: 'Billing Webhooks',
      description: 'Polar webhook signature verification',
      configured: Boolean(process.env.POLAR_WEBHOOK_SECRET),
      hint: 'Set POLAR_WEBHOOK_SECRET — webhooks accepted but unverified without it',
    },
    {
      name: 'Database (D1)',
      description: 'User data, proposals, billing',
      configured: true, // D1 is bound at the Worker level, always available
      hint: 'Bound via wrangler.toml [[d1_databases]] binding',
    },
    {
      name: 'Cron',
      description: 'Scheduled email processing',
      configured: Boolean(process.env.CRON_SECRET),
      hint: 'Set CRON_SECRET — cron runs without auth check when unset',
    },
  ];
}

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const cronSecret = process.env.CRON_SECRET;
  const params = await searchParams;
  const providedKey = params.key;

  // If CRON_SECRET is set, require ?key= to view details
  if (cronSecret && providedKey !== cronSecret) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Service Status</h1>
          <p className="text-gray-400">Access restricted. Provide ?key= to view.</p>
        </div>
      </main>
    );
  }

  const services = getServiceStatuses();
  const allConfigured = services.every((s) => s.configured);
  const configuredCount = services.filter((s) => s.configured).length;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Service Status</h1>
          <p className="text-gray-400">
            {configuredCount}/{services.length} services configured
          </p>
        </div>

        {!allConfigured && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6 text-yellow-300 text-sm">
            Some services are not configured. The app runs in degraded mode — missing
            features return graceful errors instead of crashing.
          </div>
        )}

        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-start gap-4"
            >
              <span
                className={`text-xl mt-0.5 flex-shrink-0 ${service.configured ? 'text-green-400' : 'text-red-400'}`}
                aria-label={service.configured ? 'configured' : 'not configured'}
              >
                {service.configured ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-white">{service.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      service.configured
                        ? 'bg-green-900/50 text-green-300'
                        : 'bg-red-900/50 text-red-300'
                    }`}
                  >
                    {service.configured ? 'OK' : 'Missing'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">{service.description}</p>
                {!service.configured && (
                  <p className="text-yellow-400 text-xs mt-1">{service.hint}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 text-xs mt-8">
          sophia-proposal · {new Date().toISOString()}
        </p>
      </div>
    </main>
  );
}
