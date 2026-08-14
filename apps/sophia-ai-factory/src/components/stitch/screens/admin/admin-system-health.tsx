'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { SystemService } from './admin-page-types';

export function AdminSystemHealth({ services }: { services: SystemService[] }) {
  const t = useTranslations('stitch.admin');

  return (
    <section aria-label={t('aria.systemHealth')} className="bg-surface-container border border-outline-variant rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-on-surface">{t('systems.title')}</h3>
        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
          {t('systems.allOperational')}
        </span>
      </div>

      <div className="space-y-4">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high"
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-2 h-2 rounded-full ${
                  service.status === 'healthy' ? 'bg-emerald-500' : 'bg-error'
                }`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-on-surface">{service.name}</span>
            </div>
            <span className="text-xs text-on-surface-variant">{service.latency}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
