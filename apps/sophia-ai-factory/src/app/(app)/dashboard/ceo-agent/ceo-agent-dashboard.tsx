import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import type { RevenueSnapshot } from '@/seed/types/analytics-revenue';
import { Skeleton } from '@/seed/components/ui/skeleton';

type Tab = 'briefing' | 'campaigns' | 'revenue';

interface DashboardProps {
  locale: string;
  userId: string;
  tab: Tab;
}

// ── Briefing tab (server-rendered, no client deps) ───────────────────────────

async function BriefingTab({ locale, userId }: { locale: string; userId: string }) {
  const t = await getTranslations({ locale, namespace: 'dashboard.ceoAgent' });
  const { generateDailyBriefing } = await import('@/forest/agents/daily-briefing/briefing-generator');
  const { DailyBriefingCard } = await import('@/forest/components/agents/daily-briefing-card');
  const briefing = await generateDailyBriefing(userId, locale);
  return <DailyBriefingCard briefing={briefing} />;
}

// ── Campaigns tab (client-wrapped for grid interactivity) ─────────────────────

function CampaignsTabClient({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<CampaignSkeleton />}>
      <CampaignGridInner userId={userId} />
    </Suspense>
  );
}

async function CampaignGridInner({ userId }: { userId: string }) {
  const { CampaignGrid } = await import('@/forest/dashboard/campaign/campaign-grid');
  const { fetchRecentCampaigns } = await import('@/forest/dashboard/metrics');
  const result = await fetchRecentCampaigns(userId, 10);
  const campaigns = result.ok ? result.data : [];
  return <CampaignGrid campaigns={campaigns} onCampaignSelect={() => {}} />;
}

// ── Revenue tab (client-wrapped for chart interactivity) ──────────────────────

function RevenueTabClient() {
  return (
    <Suspense fallback={<RevenueSkeleton />}>
      <RevenueInner />
    </Suspense>
  );
}

async function RevenueInner() {
  const { RevenueCard } = await import('@/forest/components/analytics/revenue-card');
  const { UnifiedRevenueChart } = await import('@/forest/components/analytics/unified-revenue-chart');
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/analytics/revenue-unified?period=30d`,
    { next: { revalidate: 120 } }
  );
  const data = await res.json().catch(() => null);
  return (
    <div className="space-y-6">
      <RevenueCard snapshot={(data ?? null) as RevenueSnapshot} />
      <UnifiedRevenueChart />
    </div>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function BriefingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function CampaignSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}

function RevenueSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

// ── Main dashboard router ─────────────────────────────────────────────────────

export async function CeoAgentDashboard({ locale, userId, tab }: DashboardProps) {
  const t = await getTranslations({ locale, namespace: 'dashboard.ceoAgent' });

  const tabs: Record<Tab, { client: React.ReactNode; label: string }> = {
    briefing: {
      client: (
        <Suspense fallback={<BriefingSkeleton />}>
          <BriefingTab userId={userId} locale={locale} />
        </Suspense>
      ),
      label: t('tabs.briefing'),
    },
    campaigns: {
      client: <CampaignsTabClient userId={userId} />,
      label: t('tabs.campaigns'),
    },
    revenue: {
      client: <RevenueTabClient />,
      label: t('tabs.revenue'),
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{tabs[tab].label}</span>
      </div>
      {tabs[tab].client}
    </div>
  );
}
