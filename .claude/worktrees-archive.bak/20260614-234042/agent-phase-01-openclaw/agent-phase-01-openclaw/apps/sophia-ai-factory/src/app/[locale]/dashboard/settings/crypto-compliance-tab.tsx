'use client';

/**
 * crypto-compliance-tab.tsx — Tenant crypto jurisdiction declaration UI
 *
 * Allows the tenant/founder to declare their primary audience jurisdiction
 * for crypto affiliate content. This determines which disclaimer text is
 * used and which channels are blocked.
 *
 * Simple design: non-tech CEO can understand at a glance.
 * Bilingual: English + Vietnamese.
 *
 * @module app/[locale]/dashboard/settings/crypto-compliance-tab
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CRYPTO_JURISDICTIONS, type CryptoJurisdiction } from '@/seed/config/crypto-disclaimer-registry';
import { getBannedChannelsForJurisdiction, isChannelBannedForCrypto } from '@/seed/config/crypto-banned-channels';

interface CryptoComplianceTabProps {
  /** Current saved jurisdiction (from tenant_settings.crypto_jurisdiction). */
  currentJurisdiction: CryptoJurisdiction | null;
  /** Called when user saves a new selection. */
  onSave: (jurisdiction: CryptoJurisdiction) => Promise<void>;
}

const JURISDICTION_LABELS: Record<CryptoJurisdiction, { label: string; flag: string; note: string }> = {
  US: { label: 'United States', flag: '🇺🇸', note: 'SEC/CFTC — past performance warning required' },
  EU: { label: 'European Union', flag: '🇪🇺', note: 'MiCA 2023/1114 — capital-at-risk warning required' },
  VN: { label: 'Vietnam', flag: '🇻🇳', note: 'BLOCKED — crypto promotion is prohibited by law' },
  SG: { label: 'Singapore', flag: '🇸🇬', note: 'MAS PSN08 — DPT risk warning required' },
  JP: { label: 'Japan', flag: '🇯🇵', note: 'FSA — registered exchange disclosure required' },
};

export function CryptoComplianceTab({ currentJurisdiction, onSave }: CryptoComplianceTabProps) {
  const t = useTranslations('cryptoCompliance');
  const [selected, setSelected] = React.useState<CryptoJurisdiction>(
    currentJurisdiction ?? 'US'
  );
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const bannedChannels = getBannedChannelsForJurisdiction(selected);
  const isBlocked = selected === 'VN';

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Jurisdiction selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="jurisdiction-select">
          {t('jurisdictionLabel')}
        </label>
        <select
          id="jurisdiction-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value as CryptoJurisdiction)}
          className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CRYPTO_JURISDICTIONS.map((code) => {
            const { label, flag } = JURISDICTION_LABELS[code];
            return (
              <option key={code} value={code}>
                {flag} {label} ({code})
              </option>
            );
          })}
        </select>
        <p className="text-xs text-muted-foreground">
          {JURISDICTION_LABELS[selected].note}
        </p>
      </div>

      {/* VN block warning */}
      {isBlocked && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>{t('blockedTitle')}</strong>
          <p className="mt-1">{t('blockedDescription')}</p>
        </div>
      )}

      {/* Banned channels summary */}
      {bannedChannels.length > 0 && !isBlocked && (
        <div className="rounded-md border border-yellow-400/40 bg-yellow-50/50 p-4 text-sm dark:bg-yellow-900/10">
          <strong className="text-yellow-700 dark:text-yellow-400">{t('bannedChannelsTitle')}</strong>
          <ul className="mt-1 list-disc pl-4 space-y-0.5 text-yellow-700 dark:text-yellow-400">
            {bannedChannels.map((ch) => (
              <li key={ch}>{ch}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t('bannedChannelsNote')}</p>
        </div>
      )}

      {/* Disclaimer preview */}
      <div className="rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">{t('previewTitle')}</p>
        <p className="italic">{t(`disclaimerPreview.${selected}`)}</p>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || isBlocked}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? t('saving') : saved ? t('saved') : t('save')}
      </button>
    </div>
  );
}
