'use client';

/**
 * Leaderboard tab + period switcher.
 * Client component — updates URL searchParams without full navigation.
 * @module app/[locale]/dashboard/leaderboard/tab-switcher
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface Props {
  activeTab: string;
  activePeriod: string;
  tabLabels: { creators: string; affiliates: string };
  periodLabels: { '7d': string; '30d': string; all: string };
}

export function TabSwitcher({ activeTab, activePeriod, tabLabels, periodLabels }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (tab: string, period: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      params.set('period', period);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const tabBase =
    'px-4 py-2 text-sm font-medium rounded-md transition-colors';
  const tabActive = 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/40';
  const tabInactive = 'text-muted-foreground hover:text-foreground hover:bg-muted/40';

  const periodBase = 'px-3 py-1.5 text-xs font-medium rounded transition-colors';
  const periodActive = 'bg-muted text-foreground';
  const periodInactive = 'text-muted-foreground hover:text-foreground';

  const periods: Array<'7d' | '30d' | 'all'> = ['7d', '30d', 'all'];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between mb-6">
      <div className="flex gap-2">
        <button
          className={`${tabBase} ${activeTab === 'creators' ? tabActive : tabInactive}`}
          onClick={() => navigate('creators', activePeriod)}
          aria-pressed={activeTab === 'creators'}
        >
          {tabLabels.creators}
        </button>
        <button
          className={`${tabBase} ${activeTab === 'affiliates' ? tabActive : tabInactive}`}
          onClick={() => navigate('affiliates', activePeriod)}
          aria-pressed={activeTab === 'affiliates'}
        >
          {tabLabels.affiliates}
        </button>
      </div>

      <div className="flex gap-1 rounded-md border border-border p-1">
        {periods.map((p) => (
          <button
            key={p}
            className={`${periodBase} ${activePeriod === p ? periodActive : periodInactive}`}
            onClick={() => navigate(activeTab, p)}
            aria-pressed={activePeriod === p}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>
    </div>
  );
}
