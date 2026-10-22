'use client';

/**
 * Settings Jurisdiction Picker — declare the region content is published to.
 *
 * The compliance gate refuses regulated verticals (crypto, financial trading)
 * when no region is declared, so this field is not cosmetic: leaving it empty
 * silently holds back that content. The UI states that consequence in plain
 * language next to the control instead of leaving it to be discovered.
 *
 * Persists through `PUT /api/v1/settings/geo`, which validates the code shape.
 * The generic namespace route is deliberately avoided — it does not validate.
 *
 * Region data and response parsers live in
 * `@/seed/compliance/jurisdiction-options`; this file is the view. Interface
 * strings come from the shared `cryptoCompliance` translation namespace.
 *
 * @module components/settings/settings-jurisdiction-picker
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Globe, Loader2, CheckCircle2, AlertCircle, TriangleAlert } from 'lucide-react';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import {
  JURISDICTION_OPTIONS,
  UNDECLARED_SELECT_VALUE,
  errorMessageFromBody,
  findJurisdictionOption,
  jurisdictionLabel,
  readDeclaredCode,
  type PickerLocale,
} from '@/seed/compliance/jurisdiction-options';

const GEO_ENDPOINT = '/api/v1/settings/geo';

/** Amber/red callout used for the region consequence warnings. */
function WarningBanner({ tone, children }: { tone: 'amber' | 'red'; children: React.ReactNode }) {
  const palette =
    tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
      : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300';
  return (
    <div
      role="alert"
      data-testid={tone === 'amber' ? 'jurisdiction-undeclared-warning' : 'jurisdiction-blocked-warning'}
      className={`p-4 rounded-xl flex items-start gap-3 text-xs border ${palette}`}
    >
      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

export function SettingsJurisdictionPicker() {
  const csrfHeaders = useCsrfToken();
  const t = useTranslations('cryptoCompliance');
  // The label language follows the app locale rather than a separate cookie
  // read, so the copy from `useTranslations` and the region names can never
  // disagree and show two languages on one screen.
  const activeLocale = useLocale();
  const locale: PickerLocale = activeLocale === 'vi' ? 'vi' : 'en';
  const [declaredCode, setDeclaredCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(UNDECLARED_SELECT_VALUE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  // A failed load is remembered as a flag rather than a localized string, so the
  // display language can change without refetching or losing the error.
  const [loadFailed, setLoadFailed] = useState(false);

  /** Load failure is reported by the caller so this stays locale-independent. */
  const load = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch(GEO_ENDPOINT);
      if (!res.ok) return false;
      const body: unknown = await res.json();
      const code = readDeclaredCode((body as { value?: unknown }).value);
      setDeclaredCode(code);
      setSelected(code ?? UNDECLARED_SELECT_VALUE);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load().then((ok: boolean) => setLoadFailed(!ok));
  }, [load]);

  useEffect(() => {
    if (loadFailed) setFeedback({ ok: false, message: t('loadError') });
  }, [loadFailed, t]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const targetJurisdiction = selected === UNDECLARED_SELECT_VALUE ? null : selected;
      const res = await fetch(GEO_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders },
        body: JSON.stringify({ targetJurisdiction }),
      });
      if (!res.ok) {
        const reason = errorMessageFromBody(await res.text().catch(() => ''));
        setFeedback({
          ok: false,
          message: `${t('saveError')}${reason ? ` ${reason}` : ''} (HTTP ${res.status})`,
        });
        return;
      }
      const saved: unknown = await res.json();
      const code = readDeclaredCode((saved as { value?: unknown }).value);
      setDeclaredCode(code);
      setSelected(code ?? UNDECLARED_SELECT_VALUE);
      setFeedback({ ok: true, message: t('saved') });
    } catch {
      setFeedback({ ok: false, message: t('networkError') });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="bg-card dark:bg-[#11131F] rounded-2xl p-6 shadow-sm border border-border dark:border-white/[0.08]">
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span>{t('loading')}</span>
        </div>
      </section>
    );
  }

  const selectedCode = selected === UNDECLARED_SELECT_VALUE ? null : selected;
  const selectedOption = findJurisdictionOption(selectedCode);
  const optionNote = selectedOption
    ? locale === 'vi'
      ? selectedOption.noteVi
      : selectedOption.noteEn
    : null;

  return (
    <section className="bg-card dark:bg-[#11131F] rounded-2xl p-6 shadow-sm border border-border dark:border-white/[0.08] space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground dark:text-white mb-2 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          {t('title')}
        </h3>
        <p className="text-xs text-muted-foreground max-w-2xl">{t('description')}</p>
      </div>

      <form onSubmit={save} className="space-y-4">
        <div>
          <label
            htmlFor="target-jurisdiction"
            className="block text-xs font-semibold text-muted-foreground mb-1.5"
          >
            {t('jurisdictionLabel')}
          </label>
          <select
            id="target-jurisdiction"
            aria-label={t('jurisdictionLabel')}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isSaving}
            className="w-full sm:max-w-md h-[50px] px-4 rounded-xl border border-border dark:border-white/[0.08] bg-background dark:bg-[#090A10] text-sm text-foreground dark:text-white disabled:opacity-50"
          >
            {JURISDICTION_OPTIONS.map((option) => (
              <option
                key={option.code ?? 'UNDECLARED'}
                value={option.code ?? UNDECLARED_SELECT_VALUE}
              >
                {locale === 'vi' ? option.labelVi : option.labelEn}
              </option>
            ))}
          </select>
        </div>

        {selectedCode === null && (
          <WarningBanner tone="amber">{t('undeclaredWarning')}</WarningBanner>
        )}

        {selectedCode === 'VN' && (
          <WarningBanner tone="red">{t('blockedWarning')}</WarningBanner>
        )}

        {optionNote && <p className="text-xs text-muted-foreground max-w-2xl">{optionNote}</p>}

        {feedback && (
          <div
            role={feedback.ok ? 'status' : 'alert'}
            className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
              feedback.ok
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30'
            }`}
          >
            {feedback.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span data-testid="jurisdiction-feedback">{feedback.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
            {isSaving ? t('saving') : t('save')}
          </button>
          <span className="text-xs text-muted-foreground">
            {t('currentRegion')}: {jurisdictionLabel(declaredCode, locale)}
          </span>
        </div>
      </form>
    </section>
  );
}
