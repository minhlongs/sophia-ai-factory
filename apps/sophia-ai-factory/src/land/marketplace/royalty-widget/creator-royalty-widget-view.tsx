import React, { useState } from 'react';
import type { CreatorBalanceSummary } from '@/tree/marketplace/types';
import { requestWithdrawal } from '@/land/marketplace/marketplace-actions';
import type { CreatorRoyaltyWidgetProps, PayoutFormData, StatusMessage } from './types';
import { BalanceSummary } from './balance-summary';
import { PayoutDialog } from './payout-dialog';

export function CreatorRoyaltyWidgetView({
  initialBalance,
  onWithdrawalRequested,
}: CreatorRoyaltyWidgetProps) {
  const [balance, setBalance] = useState<CreatorBalanceSummary | null>(initialBalance ?? null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<PayoutFormData>({
    amountUsd: '50',
    rail: 'USDT',
    destinationAddress: '',
    bankBin: '',
    bankAccountNumber: '',
    bankAccountName: '',
  });
  const [isPending, setIsPending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);

  const availableUsd = ((balance?.availableBalanceCents ?? 0) / 100).toFixed(2);

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setStatusMsg(null);

    const cents = Math.round(parseFloat(formData.amountUsd) * 100);
    if (isNaN(cents) || cents < 5000) {
      setStatusMsg({ type: 'error', text: 'Minimum withdrawal amount is $50.00 (5,000 cents).' });
      setIsPending(false);
      return;
    }

    try {
      const res = await requestWithdrawal({
        amountCents: cents,
        rail: formData.rail,
        destinationAddress: formData.rail === 'USDT' ? formData.destinationAddress : undefined,
        bankBin: formData.rail === 'VIETQR' ? formData.bankBin : undefined,
        bankAccountNumber: formData.rail === 'VIETQR' ? formData.bankAccountNumber : undefined,
        bankAccountName: formData.rail === 'VIETQR' ? formData.bankAccountName : undefined,
      });

      if (res.success && res.data) {
        setStatusMsg({
          type: 'success',
          text: `Withdrawal request submitted! ID: ${res.data.withdrawalId.slice(0, 16)}...`,
        });
        if (balance && res.data.remainingBalanceCents !== undefined) {
          setBalance({
            ...balance,
            availableBalanceCents: res.data.remainingBalanceCents,
            totalWithdrawnCents: balance.totalWithdrawnCents + cents,
          });
        }
        if (onWithdrawalRequested) onWithdrawalRequested();
        setTimeout(() => setShowModal(false), 2000);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to request withdrawal' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: String(err) });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <BalanceSummary balance={balance} onOpenPayout={() => setShowModal(true)} />
      <PayoutDialog
        showModal={showModal}
        onClose={() => setShowModal(false)}
        availableUsd={availableUsd}
        formData={formData}
        setFormData={setFormData}
        statusMsg={statusMsg}
        isPending={isPending}
        onSubmit={handleWithdrawalSubmit}
      />
    </>
  );
}
