import { Suspense } from 'react';
import { checkCreatorAccess } from './ServerGate';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SOPClientTabs } from './SOPClientTabs';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SOPCreatorPage({ params }: PageProps) {
  const { locale } = await params;
  const access = await checkCreatorAccess();
  const t = await getTranslations({ locale, namespace: 'sop.creator' }); // eslint-disable-line @typescript-eslint/no-unused-vars

  if (!access.hasAccess) {
    redirect(`/${locale}/dashboard/sop-creator/apply`);
  }

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading creator dashboard...</div>}>
      <SOPCreatorDashboard locale={locale} userId={access.userId!} />
    </Suspense>
  );
}

async function SOPCreatorDashboard({ locale, userId }: { locale: string; userId: string }) {
  const t = await getTranslations({ locale, namespace: 'sop.creator' });

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('dashboard.description')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard title={t('dashboard.stats.listings')} value="0" icon="FileText" />
          <StatCard title={t('dashboard.stats.drafts')} value="0" icon="FileText" variant="muted" />
          <StatCard title={t('dashboard.stats.published')} value="0" icon="Globe" variant="success" />
          <StatCard title={t('dashboard.stats.earnings')} value="$0" icon="DollarSign" variant="primary" />
        </div>

        {/* Client-side tabs */}
        <SOPClientTabs locale={locale} userId={userId} />
      </div>
    </main>
  );
}

// Helper components (server-side)
import { FileText, Globe, DollarSign } from 'lucide-react';

function StatCard({ title, value, icon, variant = 'default' }: { title: string; value: string; icon: string; variant?: 'default' | 'muted' | 'success' | 'primary' }) {
  const iconMap: Record<string, React.ReactNode> = {
    FileText: <FileText className="w-5 h-5" />,
    Globe: <Globe className="w-5 h-5" />,
    DollarSign: <DollarSign className="w-5 h-5" />,
  };

  const variantClasses = {
    default: 'bg-card border',
    muted: 'bg-card border border-muted',
    success: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    primary: 'bg-primary/10 border-primary/30',
  };

  return (
    <div className={variantClasses[variant] + ' rounded-lg p-6'}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="text-primary">{iconMap[icon]}</div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}