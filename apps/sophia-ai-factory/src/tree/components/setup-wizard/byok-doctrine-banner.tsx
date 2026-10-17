'use client'

/**
 * BYOK doctrine reminder shown at top of Setup Wizard system-check step.
 *
 * 3-bullet bilingual reminder per Sophia no-tech doctrine v1.28.1:
 *  - Customer owns 100% of API keys (BYOK)
 *  - Operator manages platform code only (no operator third-party setup)
 *  - 30-day refund window backs every purchase
 *
 * Bilingual via next-intl namespace `setupWizard.doctrine.*`.
 *
 * @module tree/components/setup-wizard/byok-doctrine-banner
 */

import { Key, Server, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface BulletProps {
  icon: React.ReactNode
  title: string
  body: string
}

function Bullet({ icon, title, body }: BulletProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-[#F8F9FC] dark:bg-[#090A10]/80 px-3.5 py-3 border border-border dark:border-white/[0.08]">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-[#4338CA]/10 dark:bg-[#6366F1]/15 border border-[#4338CA]/20 dark:border-[#6366F1]/25 flex items-center justify-center text-[#4338CA] dark:text-[#6366F1]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

export function ByokDoctrineBanner() {
  const t = useTranslations('setupWizard.doctrine')
  return (
    <section
      aria-label={t('aria_label')}
      className="rounded-xl border border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] px-4 py-4 space-y-3 shadow-xs"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight">{t('title')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
        <span className="hidden sm:inline-flex items-center font-mono text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#D97706]/10 dark:bg-[#F59E0B]/10 text-[#D97706] dark:text-[#F59E0B] border border-[#D97706]/20 dark:border-[#F59E0B]/20 shrink-0">
          BYOK · AES-256-GCM
        </span>
      </header>
      <div className="grid sm:grid-cols-3 gap-2.5">
        <Bullet
          icon={<Key className="w-4 h-4" aria-hidden="true" />}
          title={t('bullet_keys_title')}
          body={t('bullet_keys_body')}
        />
        <Bullet
          icon={<Server className="w-4 h-4" aria-hidden="true" />}
          title={t('bullet_platform_title')}
          body={t('bullet_platform_body')}
        />
        <Bullet
          icon={<ShieldCheck className="w-4 h-4" aria-hidden="true" />}
          title={t('bullet_refund_title')}
          body={t('bullet_refund_body')}
        />
      </div>
    </section>
  )
}
