/**
 * Dashboard hero greeting card — glass morphism style.
 * Shows personalized greeting for returning users.
 */

import { User2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

interface DashboardHeroGreetingProps {
  name: string | undefined;
  tier: string;
}

export async function DashboardHeroGreeting({ name, tier }: DashboardHeroGreetingProps) {
  const t = await getTranslations('dashboard.home');

  const greeting = name
    ? t('greeting', { name })
    : t('greeting_fallback');

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg rounded-xl p-6 flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 shrink-0">
        <User2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{greeting}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          {tier} plan
        </p>
      </div>
    </div>
  );
}
