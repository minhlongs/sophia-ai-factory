import { Link } from '@/navigation';

// i18n-namespace: guide

export interface Step {
  num: number;
  titleKey: string;
  descKey: string;
  calloutKey?: string;
}

export const STEPS: Step[] = [
  { num: 1, titleKey: 'step1_title', descKey: 'step1_desc', calloutKey: 'callout_no_account' },
  { num: 2, titleKey: 'step2_title', descKey: 'step2_desc', calloutKey: 'callout_keys_info' },
  { num: 3, titleKey: 'step3_title', descKey: 'step3_desc' },
  { num: 4, titleKey: 'step4_title', descKey: 'step4_desc' },
  { num: 5, titleKey: 'step5_title', descKey: 'step5_desc' },
];

export interface NextStep {
  titleKey: string;
  descKey: string;
  href: string;
  emoji: string;
}

export const NEXT_STEPS: NextStep[] = [
  { titleKey: 'next_step_telegram', descKey: 'next_step_telegram_desc', href: '/dashboard', emoji: '\u{1F4F1}' },
  { titleKey: 'next_step_how', descKey: 'next_step_how_desc', href: '/pricing', emoji: '⚙️' },
  { titleKey: 'next_step_faq', descKey: 'next_step_faq_desc', href: '/pricing', emoji: '❓' },
];

export function GuideSections({ t }: { t: (key: string) => string }) {
  return (
    <>
      <div className="mb-12">
        <h2 className="text-xl font-bold text-white mb-6">
          {t('gettingStarted.steps_title')}
        </h2>
        <div className="space-y-6">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="bg-card border border-border rounded-xl p-6 flex gap-4"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {step.num}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">
                  {t(`gettingStarted.${step.titleKey}`)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`gettingStarted.${step.descKey}`)}
                </p>
                {step.calloutKey && (
                  <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-xs text-muted-foreground">
                    {t(`gettingStarted.${step.calloutKey}`)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-12">
        <h2 className="text-lg font-bold text-white mb-2">
          {t('gettingStarted.step5_title')}
        </h2>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span>{t('gettingStarted.step5_telegram')}</span>
          <span>{t('gettingStarted.step5_email')}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">
          {t('gettingStarted.next_steps_title')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {NEXT_STEPS.map((step) => (
            <Link
              key={step.titleKey}
              href={step.href}
              className="flex items-start gap-3 bg-muted/30 hover:bg-muted/50 rounded-lg p-4 transition-colors"
            >
              <span className="text-xl mt-0.5">{step.emoji}</span>
              <div>
                <p className="text-sm font-medium text-white">
                  {t(`gettingStarted.${step.titleKey}`)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(`gettingStarted.${step.descKey}`)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
