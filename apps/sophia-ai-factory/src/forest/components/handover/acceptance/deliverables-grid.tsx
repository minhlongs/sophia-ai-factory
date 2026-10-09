/**
 * Acceptance Client Submodule: Deliverables Grid (15 Critical Assets).
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/deliverables-grid
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Layers } from 'lucide-react';
import { DELIVERABLES_CATALOG } from './deliverables-catalog';

export function DeliverablesGrid() {
  const t = useTranslations('handover');

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            {t('deliverables.title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('deliverables.subtitle')}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-muted-foreground">
          15 / 15 Deliverables Verified
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DELIVERABLES_CATALOG.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Check className="w-3 h-3" />
                    {t('deliverables.verified')}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t(`deliverables.${item.titleKey}`)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {t(`deliverablesDescriptions.${item.id}`)}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>ID: {item.id}</span>
                <span className="capitalize">{item.category}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
