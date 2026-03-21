/**
 * API Keys Settings Page
 *
 * Dashboard page for managing RaaS external API keys.
 */

import { ApiKeyManager } from '@/components/raas/api-key-manager';

export const metadata = {
  title: 'API Keys — Settings',
};

export default function ApiKeysPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage API keys for external RaaS integrations. Use{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-xs">
            Authorization: Bearer sk_live_…
          </code>{' '}
          in requests to <code className="rounded bg-gray-100 px-1 font-mono text-xs">/api/v1/missions</code>.
        </p>
      </div>
      <ApiKeyManager />
    </div>
  );
}
