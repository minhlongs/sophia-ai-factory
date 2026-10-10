'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { buildOnboardingSteps, StepCard, type WelcomeData } from '../welcome-onboarding-steps';
import { generateTelegramPairingTokenAction } from '@/app/actions/generate-telegram-pairing-token';
import { WelcomeHero } from './welcome-hero';
import { TelegramCta } from './telegram-cta';
import { InvalidLinkView } from './invalid-link-view';
import type { WelcomePageClientProps } from './types';

const BOT_USERNAME = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'Sophia_Bbot').replace(/^@/, '').trim();

export function WelcomePageClient({ token, locale }: WelcomePageClientProps) {
  const t = useTranslations('welcome');
  const [data, setData] = useState<WelcomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [telegramLinking, setTelegramLinking] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/welcome/validate/${token}`);
        if (!res.ok) {
          setError(t('errors.validateInvalid'));
          return;
        }
        setData(await res.json() as WelcomeData);
      } catch {
        setError(t('errors.validateConnection'));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, t]);

  async function handleGetStarted() {
    setStarted(true);
    try {
      const res = await fetch(`/api/welcome/validate/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const resData = await res.json() as { redirectUrl?: string };
      window.location.href = resData.redirectUrl ?? `/${locale}/dashboard`;
    } catch {
      window.location.href = `/${locale}/dashboard`;
    }
  }

  async function handleConnectTelegram() {
    setTelegramLinking(true);
    try {
      const { token: pairingToken } = await generateTelegramPairingTokenAction();
      const botUrl = `https://t.me/${BOT_USERNAME}?start=${pairingToken}`;
      window.open(botUrl, '_blank', 'noopener,noreferrer');
      setTelegramLinked(true);
    } catch {
      // Client-side: error silently swallowed; server-side logger unreachable from client component.
    } finally {
      setTelegramLinking(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 aria-hidden="true" size={32} className="animate-spin text-primary-400" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (error || !data) {
    return <InvalidLinkView locale={locale} message={error} />;
  }

  const steps = buildOnboardingSteps(data);

  return (
    <div className="min-h-screen bg-background">
      <WelcomeHero
        agencyName={data.agencyName}
        tier={data.tier}
        started={started}
        onGetStarted={() => void handleGetStarted()}
      />

      <TelegramCta
        telegramLinked={telegramLinked}
        telegramLinking={telegramLinking}
        onConnectTelegram={() => void handleConnectTelegram()}
      />

      <div className="max-w-2xl mx-auto px-6 pb-16">
        <h2 className="text-sm font-medium text-muted-foreground mb-4 text-center uppercase tracking-wider">
          {t('roadmapHeader')}
        </h2>
        <div className="space-y-3">
          {steps.map((s) => (
            <StepCard key={s.id} step={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
