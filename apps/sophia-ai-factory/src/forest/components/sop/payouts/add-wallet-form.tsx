'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';

interface AddWalletAddressFormProps {
  onAdded: () => void;
}

export function AddWalletAddressForm({ onAdded }: AddWalletAddressFormProps) {
  const t = useTranslations('sop.creator');
  const [method, setMethod] = useState<'usdt_trc20' | 'usdt_erc20'>('usdt_trc20');
  const [addr, setAddr] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/affiliate/payout-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          recipient_addr: addr.trim(),
          displayLabel: label.trim() || undefined,
          setDefault: true,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: unknown };
      if (!res.ok || !data.id) {
        throw new Error(
          typeof data.error === 'string' ? data.error : `Add failed (HTTP ${res.status})`,
        );
      }
      setAddr('');
      setLabel('');
      setShowForm(false);
      onAdded();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('payouts.failedToAddWallet'));
    } finally {
      setBusy(false);
    }
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-sm font-medium text-white transition-colors"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        {t('payouts.addWalletAddress')}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3"
      aria-label={t('payouts.addWalletAddress')}
    >
      <label className="text-sm block">
        <span className="block mb-1 text-white/60">{t('payouts.network')}</span>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="usdt_trc20">{t('payouts.networkUsdtTrc20')}</option>
          <option value="usdt_erc20">{t('payouts.networkUsdtErc20')}</option>
        </select>
      </label>

      <label className="text-sm block">
        <span className="block mb-1 text-white/60">{t('payouts.labelOptional')}</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={100}
          placeholder={t('payouts.labelPlaceholder')}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
        />
      </label>

      <label className="text-sm block">
        <span className="block mb-1 text-white/60">{t('payouts.walletAddress')}</span>
        <input
          type="text"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          required
          maxLength={200}
          placeholder={method === 'usdt_trc20' ? t('payouts.placeholderTrc20') : t('payouts.placeholderErc20')}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white font-mono placeholder-white/30"
        />
      </label>

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || addr.trim().length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {busy ? t('payouts.adding') : t('payouts.addWallet')}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          {t('payouts.cancel')}
        </button>
      </div>
    </form>
  );
}
