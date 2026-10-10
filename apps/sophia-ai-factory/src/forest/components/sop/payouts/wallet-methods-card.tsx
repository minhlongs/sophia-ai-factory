'use client';

import { useTranslations } from 'next-intl';
import { Wallet, Trash2 } from 'lucide-react';
import type { WalletMethod } from './types';
import { AddWalletAddressForm } from './add-wallet-form';

interface WalletMethodsCardProps {
  methods: WalletMethod[];
  onDeleteMethod: (id: string) => void;
  onAdded: () => void;
}

export function WalletMethodsCard({
  methods,
  onDeleteMethod,
  onAdded,
}: WalletMethodsCardProps) {
  const t = useTranslations('sop.creator');

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
        <Wallet className="w-4 h-4 text-white/50" aria-hidden="true" />
        <h2 className="text-sm font-medium text-white/80">{t('payouts.title')}</h2>
      </div>
      <div className="p-5">
        <p className="text-sm text-white/50 mb-4">{t('payouts.walletDesc')}</p>

        {methods.length > 0 && (
          <ul className="mb-4 rounded-xl border border-white/10 divide-y divide-white/5">
            {methods.map((m) => (
              <li key={m.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {m.method === 'usdt_trc20'
                        ? t('payouts.networkUsdtTrc20')
                        : m.method === 'usdt_erc20'
                        ? t('payouts.networkUsdtErc20')
                        : m.method === 'bank_account'
                        ? t('payouts.bankAccount')
                        : m.method}
                    </span>
                    {m.is_default === 1 && (
                      <span className="text-xs uppercase bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded font-medium">
                        {t('payouts.defaultBadge')}
                      </span>
                    )}
                    {m.verified === 0 && (
                      <span className="text-xs uppercase bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">
                        {t('payouts.unverifiedBadge')}
                      </span>
                    )}
                  </div>
                  {m.display_label && (
                    <span className="text-xs text-white/40 ml-2">{m.display_label}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteMethod(m.id)}
                  className="text-red-400 hover:text-red-300 transition-colors shrink-0"
                  aria-label={t('payouts.removePayoutMethod')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <AddWalletAddressForm onAdded={onAdded} />
      </div>
    </div>
  );
}
