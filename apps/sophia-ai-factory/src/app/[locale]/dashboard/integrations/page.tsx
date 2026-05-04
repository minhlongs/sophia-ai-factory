/**
 * Dashboard Integrations Page — /dashboard/integrations
 *
 * Lists all available integrations with connection status.
 * Admin-hook: "Configure" links open setup wizard or show coming-soon modal.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/seed/db/client';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Integration {
  id: string;
  name: string;
  description: string;
  provider: string;
  status: 'live' | 'beta' | 'coming_soon';
  icon: string;
  configureUrl?: string;
  docUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'heygen',
    name: 'HeyGen',
    description: 'AI avatar video generation (video:create, video:status)',
    provider: 'heygen',
    status: 'live',
    icon: 'videocam',
    configureUrl: '/setup-wizard',
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Email campaigns and transactional emails (email:campaign, email:test)',
    provider: 'resend',
    status: 'live',
    icon: 'email',
    configureUrl: '/setup-wizard',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (LLM)',
    description: 'AI proposal and content generation (proposal:create)',
    provider: 'openrouter',
    status: 'live',
    icon: 'psychology',
    configureUrl: '/setup-wizard',
  },
  {
    id: 'apollo',
    name: 'Apollo.io',
    description: 'Lead discovery and enrichment (lead:find, lead:enrich, lead:export)',
    provider: 'apollo',
    status: 'beta',
    icon: 'manage_search',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Publish and manage YouTube videos (youtube:publish, youtube:list-channels)',
    provider: 'youtube_oauth',
    status: 'beta',
    icon: 'smart_display',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Voice cloning and text-to-speech (voice:clone)',
    provider: 'elevenlabs',
    status: 'beta',
    icon: 'record_voice_over',
  },
  {
    id: 'did',
    name: 'D-ID',
    description: 'AI avatar video alternative to HeyGen',
    provider: 'did',
    status: 'coming_soon',
    icon: 'face',
  },
  {
    id: 'webhook',
    name: 'Outbound Webhooks',
    description: 'Receive mission completion, video, and payment events via HMAC-signed POST requests. Connect to Slack, Zapier, n8n, or your own server.',
    provider: 'sophia_webhook_secret',
    status: 'live',
    icon: 'webhook',
    configureUrl: '/dashboard/integrations/webhooks',
  },
];

interface CredRow {
  provider: string;
}

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const db = createServerClient();

  // Fetch which providers are connected
  const { data: credentials } = await db
    .from('user_provider_credentials')
    .select('provider')
    .eq('user_id', user.id) as { data: CredRow[] | null; error: unknown };

  const connectedProviders = new Set((credentials ?? []).map(c => c.provider));

  const integrationsWithStatus = INTEGRATIONS.map(integration => ({
    ...integration,
    connected: connectedProviders.has(integration.provider),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your API keys to unlock AI command capabilities
        </p>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrationsWithStatus.map(integration => (
          <div
            key={integration.id}
            className={`bg-card border rounded-lg p-4 flex items-start gap-4 ${
              integration.status === 'coming_soon' ? 'opacity-60' : ''
            }`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">
                {integration.icon}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sm">{integration.name}</h3>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  integration.status === 'live'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : integration.status === 'beta'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {integration.status === 'coming_soon' ? 'Coming Soon' : integration.status}
                </span>
                {integration.connected && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{integration.description}</p>
            </div>

            {/* Action */}
            <div className="flex-shrink-0">
              {integration.configureUrl && integration.status !== 'coming_soon' ? (
                <Link
                  href={integration.configureUrl}
                  className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
                >
                  {integration.connected ? 'Reconfigure' : 'Configure'}
                </Link>
              ) : integration.status === 'coming_soon' ? (
                <span className="text-xs px-3 py-1.5 border rounded-md text-muted-foreground cursor-not-allowed">
                  Soon
                </span>
              ) : (
                <Link
                  href="/setup-wizard"
                  className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
                >
                  {integration.connected ? 'Reconfigure' : 'Connect'}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-muted/40 border rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">How integrations work</p>
        <p>Each integration unlocks specific AI commands. Your API keys are encrypted and stored securely.
          BETA integrations use stub data while full integration is in development.</p>
      </div>
    </div>
  );
}
