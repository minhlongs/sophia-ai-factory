import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getCustomerUsageSummary } from '@/land/billing/customer-usage-summary';
import { UsageMeteringView } from '@/components/settings/usage-metering-view';
import { Link } from '@/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsUsagePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const report = await getCustomerUsageSummary(user.id);

  return (
    <div className="min-h-screen bg-background text-on-surface p-6 sm:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/30 pb-6">
          <div>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors mb-3"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Settings
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-on-surface flex items-center gap-3">
              Usage & Billing Transparency
              <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-bold">
                Live Metering
              </span>
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Transparent, real-time consumption records across all AI providers and video pipelines.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" /> Top up MCU Credits
            </Link>
          </div>
        </div>

        <UsageMeteringView report={report} />
      </div>
    </div>
  );
}
