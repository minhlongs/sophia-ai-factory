'use client';

/**
 * Cookie Consent Banner
 *
 * Non-blocking consent gate shown once per visitor. Records the choice in
 * `localStorage.sophia_consent_v1` and the `sophia_consent` cookie so both the
 * client and the server (middleware) see the same answer.
 *
 * Non-blocking by design: pinned to the bottom of the viewport with no backdrop,
 * so page content stays visible and interactive while the choice is pending.
 *
 * All strings come from the `consentBanner` namespace (resolved via
 * `useConsentTranslation`, which degrades to English on a missing key).
 */

// i18n-namespace: consentBanner

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/seed/components/ui/button';
import { createConsentState, type ConsentState } from '@/seed/compliance/consent-types';
import { hasRecordedConsent, readConsent, saveConsent } from '@/seed/compliance/consent-resolver';
import { useConsentTranslation } from './use-consent-translations';

export function CookieConsentBanner() {
  const t = useConsentTranslation();
  // null = undecided, true = shown, false = dismissed. Delays render until hydration
  // so the server markup stays stable.
  const [visible, setVisible] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    if (hasRecordedConsent()) {
      const current = readConsent();
      setAnalytics(current.analytics);
      setMarketing(current.marketing);
      setVisible(false);
      return;
    }
    setVisible(true);
  }, []);

  const commit = useCallback((next: ConsentState) => {
    saveConsent(next);
    setVisible(false);
  }, []);

  const acceptAll = useCallback(() => {
    commit(createConsentState(true, true, Date.now()));
  }, [commit]);

  const necessaryOnly = useCallback(() => {
    commit(createConsentState(false, false, Date.now()));
  }, [commit]);

  const saveCustom = useCallback(() => {
    commit(createConsentState(analytics, marketing, Date.now()));
  }, [commit, analytics, marketing]);

  if (visible !== true) return null;

  return (
    <section
      role="region"
      aria-label={t('title')}
      data-testid="cookie-consent-banner"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {t('description')}
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" size="sm" onClick={necessaryOnly}>
              {t('necessaryOnly')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((value) => !value)}
            >
              {t('customize')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={acceptAll}
              data-testid="consent-accept-all"
            >
              {t('acceptAll')}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <ConsentToggle
              label={t('analytics')}
              checked={analytics}
              onChange={setAnalytics}
              testId="consent-toggle-analytics"
            />
            <ConsentToggle
              label={t('marketing')}
              checked={marketing}
              onChange={setMarketing}
              testId="consent-toggle-marketing"
            />
            <div className="sm:col-span-2">
              <Button type="button" size="sm" onClick={saveCustom} data-testid="consent-save">
                {t('save')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface ConsentToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  testId: string;
}

function ConsentToggle({ label, checked, onChange, testId }: ConsentToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[hsl(var(--primary))]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={testId}
      />
      {label}
    </label>
  );
}

export default CookieConsentBanner;
