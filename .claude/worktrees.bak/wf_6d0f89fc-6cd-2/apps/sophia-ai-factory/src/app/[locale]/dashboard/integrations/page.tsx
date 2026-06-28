/**
 * Dashboard Integrations Page — /dashboard/integrations
 *
 * Card-based quickstart grouped by category:
 *   Channels | Webhooks | Affiliate Networks | BYOK
 * All categories are open to every authenticated user — no tier gating.
 */

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { IntegrationCard } from './integration-card';

export const dynamic = 'force-dynamic';

interface CredRow {
  provider: string;
}

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getTranslations('dashboard.integrations');

  const db = createServerClient();
  const { data: credentials } = await db
    .from('user_provider_credentials')
    .select('provider')
    .eq('user_id', user.id) as { data: CredRow[] | null; error: unknown };

  const connected = new Set((credentials ?? []).map((c) => c.provider));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('page_title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('page_subtitle')}</p>
      </div>

      {/* Channels */}
      <Section title={t('section_channels')} desc={t('section_channels_desc')}>
        <IntegrationCard name="YouTube" icon="smart_display" status="beta" isConnected={connected.has('youtube_oauth')} href="/dashboard/settings" t={t} />
        <IntegrationCard name="TikTok" icon="videocam" status="beta" isConnected={connected.has('tiktok_oauth')} href="/dashboard/settings" t={t} />
        <IntegrationCard name="Instagram" icon="photo_camera" status="beta" isConnected={connected.has('instagram_oauth')} href="/dashboard/onboarding" t={t} />
        <IntegrationCard name="Pinterest" icon="push_pin" status="coming_soon" isConnected={false} href="#" badge={t('badge_new')} t={t} />
        <IntegrationCard name="LinkedIn" icon="work" status="coming_soon" isConnected={false} href="#" badge={t('badge_new')} t={t} />
        <IntegrationCard name="Zalo" icon="chat" status="coming_soon" isConnected={false} href="#" badge={t('badge_new')} t={t} />
      </Section>

      {/* Webhooks */}
      <Section title={t('section_webhooks')} desc={t('section_webhooks_desc')}>
        <IntegrationCard
          name="Outbound Webhooks"
          icon="webhook"
          status="live"
          isConnected={connected.has('sophia_webhook_secret')}
          href="/dashboard/integrations/webhooks"
          badge={t('badge_new')}
          description="HMAC-signed POST to Slack, Zapier, n8n, or your own server."
          t={t}
        />
      </Section>

      {/* Affiliate Networks */}
      <Section title={t('section_affiliates')} desc={t('section_affiliates_desc')}>
        <IntegrationCard name="Impact" icon="swap_horiz" status="beta" isConnected={connected.has('impact')} href="/dashboard/onboarding" t={t} />
        <IntegrationCard name="PartnerStack" icon="group_work" status="beta" isConnected={connected.has('partnerstack')} href="/dashboard/onboarding" t={t} />
        <IntegrationCard name="Binance Affiliate" icon="currency_bitcoin" status="coming_soon" isConnected={false} href="#" t={t} />
        <IntegrationCard name="Bybit Affiliate" icon="show_chart" status="coming_soon" isConnected={false} href="#" t={t} />
        <IntegrationCard name="Bitget Affiliate" icon="trending_up" status="coming_soon" isConnected={false} href="#" t={t} />
        <IntegrationCard name="Coinbase Affiliate" icon="attach_money" status="coming_soon" isConnected={false} href="#" t={t} />
      </Section>

      {/* BYOK */}
      <Section title={t('section_byok')} desc={t('section_byok_desc')}>
        <IntegrationCard name="OpenRouter (LLM)" icon="psychology" status="live" isConnected={connected.has('openrouter')} href="/dashboard/byok" t={t} />
        <IntegrationCard name="ElevenLabs" icon="record_voice_over" status="live" isConnected={connected.has('elevenlabs')} href="/dashboard/byok" t={t} />
        <IntegrationCard name="D-ID" icon="face" status="live" isConnected={connected.has('did')} href="/dashboard/byok" t={t} />
      </Section>

      {/* Info */}
      <div className="bg-muted/40 border rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">{t('info_title')}</p>
        <p>{t('info_body')}</p>
      </div>
    </div>
  );
}

function Section({
  title, desc, children,
}: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {children}
      </div>
    </section>
  );
}
