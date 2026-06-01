/**
 * Webhooks dashboard page — server component fetches endpoints, renders list.
 * @module dashboard/integrations/webhooks/page
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { WebhooksPageClient } from './webhooks-page-client';
import type { WebhookEndpoint } from '@/land/webhooks/types';

export const dynamic = 'force-dynamic';

async function fetchWebhooks(userId: string): Promise<WebhookEndpoint[]> {
  try {
    // Use D1 registry directly on server — avoids self-fetch in Workers
    const { listByTenant } = await import('@/land/webhooks/registry');
    // Get D1 binding via the same pattern as other server routes
    const db = getD1ServerSide();
    if (!db) return [];
    return await listByTenant(db, userId);
  } catch {
    return [];
  }
}

function getD1ServerSide(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

export default async function WebhooksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getTranslations('dashboard.integrations.webhooks');
  const endpoints = await fetchWebhooks(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('page_title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('page_subtitle')}</p>
        </div>
      </div>

      <WebhooksPageClient initialEndpoints={endpoints} />
    </div>
  );
}
