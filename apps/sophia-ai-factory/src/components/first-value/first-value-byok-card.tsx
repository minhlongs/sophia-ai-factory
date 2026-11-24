'use client';

/**
 * BYOK status, inline pilot OpenRouter key configuration, & honest validation receipt card.
 *
 * In non-pilot mode, links to `/dashboard/setup` when unconfigured.
 * In live Customer BYOK pilot mode, allows the invited customer to enter, verify,
 * replace, or remove their own OpenRouter API key directly in the First-Value flow.
 *
 * @module components/first-value/first-value-byok-card
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import type { HonestValidationReceipt } from '@/tree/byok/honest-validation-receipt';

export interface FirstValueByokCardProps {
  readonly byokConfigured: boolean;
  readonly receipt: HonestValidationReceipt | null;
  readonly isCustomerByokPilot?: boolean;
  readonly busy?: boolean;
  readonly onSavePilotKey?: (apiKey: string) => Promise<boolean>;
  readonly onClearPilotKey?: () => Promise<boolean>;
}

export function FirstValueByokCard({
  byokConfigured,
  receipt,
  isCustomerByokPilot = false,
  busy = false,
  onSavePilotKey,
  onClearPilotKey,
}: FirstValueByokCardProps) {
  const t = useTranslations('firstValue');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  async function handleSaveKey() {
    if (!onSavePilotKey || !apiKeyInput.trim()) return;
    setSavedNotice(false);
    const ok = await onSavePilotKey(apiKeyInput.trim());
    if (ok) {
      setApiKeyInput('');
      setEditingKey(false);
      setSavedNotice(true);
    }
  }

  async function handleClearKey() {
    if (!onClearPilotKey) return;
    setSavedNotice(false);
    const ok = await onClearPilotKey();
    if (ok) {
      setApiKeyInput('');
      setEditingKey(false);
    }
  }

  if (isCustomerByokPilot) {
    const showInputForm = !byokConfigured || editingKey;
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{t('pilotByokTitle')}</h2>
          <span
            className={
              byokConfigured
                ? 'rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400'
                : 'rounded-full bg-amber-500/15 px-3 py-1 font-mono text-xs font-medium text-amber-600 dark:text-amber-400'
            }
          >
            {byokConfigured ? t('pilotByokReadyBadge') : t('pilotByokMissingBadge')}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{t('pilotByokHelp')}</p>

        {savedNotice && (
          <p className="mb-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {t('pilotByokSavedNotice')}
          </p>
        )}

        {showInputForm ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('pilotByokInputLabel')}
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKeyInput}
                disabled={busy}
                placeholder={t('pilotByokPlaceholder')}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  if (savedNotice) setSavedNotice(false);
                }}
                className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || apiKeyInput.trim().length < 16}
                onClick={() => void handleSaveKey()}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? t('loading') : t('pilotByokSaveBtn')}
              </button>
              {byokConfigured && editingKey && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditingKey(false);
                    setApiKeyInput('');
                  }}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {t('cancelEditBtn')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <span className="text-foreground">{t('pilotByokConfiguredDesc')}</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditingKey(true)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('pilotByokReplaceBtn')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleClearKey()}
                className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
              >
                {t('pilotByokClearBtn')}
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-base font-semibold text-foreground">{t('byokTitle')}</h2>
      {byokConfigured && receipt ? (
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{t('receiptProvider')}</dt>
            <dd className="font-mono font-semibold text-foreground">{receipt.provider}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('receiptAuthStatus')}</dt>
            <dd className="font-mono font-semibold text-foreground">
              {receipt.providerAuthStatus}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('receiptPaidInference')}</dt>
            <dd className="font-mono font-semibold text-foreground">false</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('receiptId')}</dt>
            <dd className="truncate font-mono text-foreground">{receipt.receiptId}</dd>
          </div>
        </dl>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <div className="font-semibold text-foreground">{t('byokUnavailable')}</div>
          <p className="text-muted-foreground">{t('byokUnavailableDesc')}</p>
          <Link
            href="/dashboard/setup"
            className="w-fit rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            {t('openSetupWizard')}
          </Link>
        </div>
      )}
    </section>
  );
}
