/**
 * First-time empty state — "Setup AI Agency in 3 Steps".
 * Shown when user has 0 installed SOPs.
 */

import Link from 'next/link';
import { Settings, BookOpen, PlayCircle, CheckCircle2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

interface SetupStep {
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
  ctaKey: string;
  href: string;
  completed: boolean;
}

interface DashboardSetupStepsProps {
  hasApiKeys: boolean;
  sopCount: number;
}

export async function DashboardSetupSteps({ hasApiKeys, sopCount }: DashboardSetupStepsProps) {
  const t = await getTranslations('dashboard.home');

  const steps: SetupStep[] = [
    {
      icon: Settings,
      titleKey: 'step1_title',
      descKey: 'step1_desc',
      ctaKey: 'step1_cta',
      href: '/dashboard/onboarding',
      completed: hasApiKeys,
    },
    {
      icon: BookOpen,
      titleKey: 'step2_title',
      descKey: 'step2_desc',
      ctaKey: 'step2_cta',
      href: '/dashboard/sop-marketplace',
      completed: sopCount > 0,
    },
    {
      icon: PlayCircle,
      titleKey: 'step3_title',
      descKey: 'step3_desc',
      ctaKey: 'step3_cta',
      href: '/dashboard/missions',
      completed: false,
    },
  ];

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg rounded-xl p-6 space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('setup_title')}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t('setup_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={index}
              className={`relative rounded-lg border p-4 transition-colors duration-150 ${
                step.completed
                  ? 'border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10'
                  : 'border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30'
              }`}
            >
              {step.completed && (
                <CheckCircle2 className="absolute top-3 right-3 w-4 h-4 text-green-500" />
              )}
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${
                step.completed
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                <Icon className={`w-4 h-4 ${step.completed ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 mb-0.5">
                Step {index + 1}
              </p>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {t(step.titleKey as Parameters<typeof t>[0])}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                {t(step.descKey as Parameters<typeof t>[0])}
              </p>
              {!step.completed && (
                <Link
                  href={step.href}
                  className="inline-block cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-150"
                >
                  {t(step.ctaKey as Parameters<typeof t>[0])} &rarr;
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
