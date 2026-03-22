/**
 * Dashboard API Keys Page
 * Lists org API keys with create/revoke actions.
 * Uses existing ApiKeyManager component from RaaS.
 */

import { ApiKeyManager } from '@/components/raas/api-key-manager';

export const metadata = {
  title: 'API Keys — Dashboard',
};

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage API keys for RaaS integrations. Use{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-xs">
            Authorization: Bearer sk_live_…
          </code>{' '}
          in requests to{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-xs">/api/v1/missions</code>.
        </p>
      </div>
      <ApiKeyManager />
    </div>
  );
}
