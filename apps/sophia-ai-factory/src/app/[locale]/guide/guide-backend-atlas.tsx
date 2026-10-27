/**
 * guide-backend-atlas.tsx
 * Part B of the Guide: Complete 100% Backend Architecture Atlas covering all 8 Pillars.
 */

import { GUIDE_BACKEND_PILLARS } from '@/seed/guide';

// i18n-namespace: guide

export function GuideBackendAtlas({
  t,
  locale,
}: {
  t: (key: string) => string;
  locale: 'vi' | 'en';
}) {
  const stats = [
    t('backendAtlas.statApis'),
    t('backendAtlas.statJobs'),
    t('backendAtlas.statMigrations'),
    t('backendAtlas.statNets'),
    t('backendAtlas.statChannels'),
    t('backendAtlas.statNiches'),
  ];

  return (
    <section className="mb-14">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          {t('backendAtlas.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('backendAtlas.subtitle')}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
          {stats.map((label) => (
            <div
              key={label}
              className="bg-card border border-border rounded-lg px-3 py-2.5 text-center"
            >
              <span className="text-xs font-bold text-primary">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {GUIDE_BACKEND_PILLARS.map((pillar) => (
          <div
            key={pillar.id}
            className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{pillar.icon}</span>
                  <div>
                    <span className="text-[11px] font-mono uppercase text-muted-foreground">
                      PILLAR 0{pillar.number} · {pillar.tag[locale]}
                    </span>
                    <h3 className="text-base font-bold text-foreground">
                      {pillar.title[locale]}
                    </h3>
                  </div>
                </div>
                <span className="flex-shrink-0 text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5">
                  {pillar.badge}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mb-3.5">
                {pillar.description[locale]}
              </p>

              <ul className="space-y-1.5 mb-4">
                {pillar.capabilities.map((cap, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-foreground/90 flex items-start gap-2"
                  >
                    <span className="text-primary font-bold mt-0.5">✓</span>
                    <span>{cap[locale]}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-border/60">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {t('backendAtlas.routesLabel')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pillar.representativeRoutes.map((route) => (
                    <code
                      key={route}
                      className="text-[11px] bg-muted/40 text-amber-300 px-2 py-0.5 rounded font-mono"
                    >
                      {route}
                    </code>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {t('backendAtlas.jobsLabel')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pillar.representativeJobs.map((job) => (
                    <code
                      key={job}
                      className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono"
                    >
                      {job}
                    </code>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 text-[11px] text-emerald-300">
                <strong className="mr-1">{t('backendAtlas.safetyLabel')}:</strong>
                {pillar.safetyPillar[locale]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
