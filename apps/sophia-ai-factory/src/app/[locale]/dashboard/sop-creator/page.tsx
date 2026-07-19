import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { hasCreatorAccess } from '@/land/sop-marketplace';
import { listTemplatesByAuthor, listCreatorSales } from '@/tree/sop/sop-repo';
import { getD1 } from '@/seed/db/get-d1';
import { CreatorDashboardTabs } from './creator-dashboard-tabs';

interface Props { params: Promise<{ locale: string }> }

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('sop.creator');
  return { title: t('pageTitle') };
}

interface EarningsSummary {
  totalEarned: number; pending: number; payable: number; paid: number;
}

const ZERO_EARNINGS: EarningsSummary = { totalEarned: 0, pending: 0, payable: 0, paid: 0 };

async function fetchEarnings(userId: string, db: D1Database): Promise<EarningsSummary> {
  try {
    const { getCreatorEarnings } = await import('@/land/sop-marketplace');
    return await getCreatorEarnings(db, userId);
  } catch { return ZERO_EARNINGS; }
}

export default async function CreatorDashboardPage({ params }: Props) {
  const { locale } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  if (!db) notFound();

  const hasAccess = await hasCreatorAccess(db, user.id);
  if (!hasAccess) redirect(`/${locale}/pricing`);

  const [templates, sales, earnings] = await Promise.all([
    listTemplatesByAuthor(db, user.id),
    listCreatorSales(db, user.id).catch(() => []),
    fetchEarnings(user.id, db),
  ]);

  // Build sales lookup: template_id -> { count, revenue }
  const salesMap: Record<string, { count: number; revenue: number }> = {};
  for (const s of sales as Array<{ template_id: string; price_cents: number }>) {
    const prev = salesMap[s.template_id] ?? { count: 0, revenue: 0 };
    salesMap[s.template_id] = { count: prev.count + 1, revenue: prev.revenue + (s.price_cents ?? 0) };
  }

  return (
    <CreatorDashboardTabs
      templates={templates}
      salesMap={salesMap}
      earnings={earnings}
    />
  );
}
