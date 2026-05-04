'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors.boundary')
  const router = useRouter()

  return (
    <div role="alert" className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <p className="text-muted-foreground">{t('message')}</p>
      <div className="flex gap-3">
        <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90">
          {t('retry')}
        </button>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-muted text-foreground rounded-md hover:opacity-90">
          {t('home')}
        </button>
      </div>
    </div>
  )
}
