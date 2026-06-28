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
    <div className="flex items-start gap-3 rounded-lg bg-card/60 px-3 py-3 border border-border/40">
      <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
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
      className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 space-y-3"
    >
      <header>
        <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t('subtitle')}</p>
      </header>
      <div className="grid sm:grid-cols-3 gap-2">
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
