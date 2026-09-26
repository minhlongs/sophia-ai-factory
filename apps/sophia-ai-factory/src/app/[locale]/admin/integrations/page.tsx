export const dynamic = 'force-dynamic';

/**
 * Enterprise CRM & Webhook Bus Admin Portal Route
 *
 * Route: /[locale]/admin/integrations
 * (e.g. /en/admin/integrations, /vi/admin/integrations)
 *
 * Layer: land (Next.js App Router Page)
 *
 * @module app/[locale]/admin/integrations/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getD1 } from '@/seed/db/client';
import { IntegrationsPortalClient } from './integrations-portal-client';
import {
  listCrmConfigs,
  listCrmSyncEvents,
} from '@/tree/integrations/crm-sync-engine';
import {
  listWebhookSubscriptions,
  listWebhookDeliveryLogs,
} from '@/tree/integrations/webhook-dispatcher';
import type {
  EnterpriseCrmConfig,
  CrmSyncEvent,
  WebhookSubscription,
  WebhookDeliveryLog,
} from '@/tree/integrations/types';

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const isVi = resolved.locale === 'vi';

  return {
    title: isVi
      ? 'Quản Trị Tích Hợp CRM & Webhook Doanh Nghiệp — Sophia Admin'
      : 'Enterprise CRM & Webhook Bus — Sophia Admin',
    description: isVi
      ? 'Đồng bộ hai chiều Salesforce & HubSpot, bảo vệ quyền uy hợp đồng LWW, và ký số Web Crypto HMAC-SHA256.'
      : 'Bi-directional Salesforce & HubSpot sync, LWW authority bias on closed contracts, and Web Crypto HMAC-SHA256 signing.',
  };
}

export default async function AdminIntegrationsPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/admin/integrations`);
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    redirect(`/${locale}/dashboard?error=admin_required`);
  }

  const tenantId = (user as { organizationId?: string; tenantId?: string }).organizationId ||
    (user as { organizationId?: string; tenantId?: string }).tenantId ||
    'default_tenant';

  const db = await getD1();

  let initialConfigs: EnterpriseCrmConfig[] = [];
  let initialSyncEvents: CrmSyncEvent[] = [];
  let initialSubscriptions: WebhookSubscription[] = [];
  let initialDeliveryLogs: WebhookDeliveryLog[] = [];

  if (db) {
    try {
      initialConfigs = await listCrmConfigs(db, tenantId);
    } catch {
      initialConfigs = [];
    }

    try {
      initialSyncEvents = await listCrmSyncEvents(db, tenantId, 25);
    } catch {
      initialSyncEvents = [];
    }

    try {
      initialSubscriptions = await listWebhookSubscriptions(db, tenantId);
    } catch {
      initialSubscriptions = [];
    }

    try {
      initialDeliveryLogs = await listWebhookDeliveryLogs(db, undefined, 25);
    } catch {
      initialDeliveryLogs = [];
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 md:px-8">
      <IntegrationsPortalClient
        initialConfigs={initialConfigs}
        initialSyncEvents={initialSyncEvents}
        initialSubscriptions={initialSubscriptions}
        initialDeliveryLogs={initialDeliveryLogs}
        tenantId={tenantId}
        locale={locale}
      />
    </main>
  );
}
