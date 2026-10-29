import { Link } from '@/navigation';

// i18n-namespace: guide

const SUPPORT_ITEMS = [
  {
    key: 'support_telegram',
    href: '#telegram',
    emoji: '\u{1F4F1}',
    external: false,
  },
  {
    key: 'support_bot',
    href: 'https://t.me/Sophia_Bbot',
    emoji: '\u{1F4AC}',
    external: true,
  },
  {
    key: 'support_email',
    href: 'mailto:support@mekongmind.com',
    emoji: '✉️',
    external: false,
  },
] as const;

const NEXT_ITEMS = [{ key: 'next_step_how', href: '/contact', emoji: '⚙️' }] as const;

export function GuideSections({ t }: { t: (key: string) => string }) {
  return (
    <div className="mb-12 space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-lg font-bold text-foreground">{t('gettingStarted.step5_title')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SUPPORT_ITEMS.map((item) => (
            <a
              key={item.key}
              href={item.href}
              {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="flex items-start gap-3 rounded-lg bg-muted/30 p-4 transition-colors hover:bg-muted/50"
            >
              <span className="mt-0.5 text-xl">{item.emoji}</span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t(`gettingStarted.${item.key}`)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(`gettingStarted.${item.key}_desc`)}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-lg font-bold text-foreground">
          {t('gettingStarted.next_steps_title')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NEXT_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-start gap-3 rounded-lg bg-muted/30 p-4 transition-colors hover:bg-muted/50"
            >
              <span className="mt-0.5 text-xl">{item.emoji}</span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t(`gettingStarted.${item.key}`)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(`gettingStarted.${item.key}_desc`)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
