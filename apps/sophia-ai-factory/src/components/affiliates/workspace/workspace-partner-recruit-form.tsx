'use client';

/**
 * Workspace Partner Recruitment Inline Form
 *
 * Allows workspace owners to recruit a new affiliate partner on VietQR (NAPAS 247)
 * or USDT (TRC-20) payout rails.
 *
 * @module components/affiliates/workspace/workspace-partner-recruit-form
 */

import React, { useState } from 'react';
import { recruitWorkspacePartnerAction } from '@/forest/actions/workspace-partner-network-actions';

interface WorkspacePartnerRecruitFormProps {
  isVi: boolean;
  onRecruited: () => void;
}

const INPUT_CLS = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground';

export function WorkspacePartnerRecruitForm({
  isVi,
  onRecruited,
}: WorkspacePartnerRecruitFormProps) {
  const [partnerCode, setPartnerCode] = useState('');
  const [commissionRatePct, setCommissionRatePct] = useState(20);
  const [payoutRail, setPayoutRail] = useState<'VIETQR' | 'USDT'>('VIETQR');
  const [bankBin, setBankBin] = useState('970422');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [usdtAddress, setUsdtAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isVietQr = payoutRail === 'VIETQR';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    const res = await recruitWorkspacePartnerAction({
      partnerCode,
      commissionRatePct,
      payoutRail,
      bankBin: isVietQr ? bankBin : undefined,
      bankAccountNumber: isVietQr ? bankAccountNumber : undefined,
      bankAccountName: isVietQr ? bankAccountName : undefined,
      usdtAddress: !isVietQr ? usdtAddress : undefined,
    });
    setSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.error ?? 'Failed to recruit partner');
      return;
    }
    setPartnerCode('');
    setBankAccountNumber('');
    setBankAccountName('');
    setUsdtAddress('');
    onRecruited();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-background/60 p-4 sm:grid-cols-3"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {isVi ? 'Mã CTV (Partner Code)' : 'Partner Code'}
        </label>
        <input type="text" required value={partnerCode} onChange={(e) => setPartnerCode(e.target.value)} placeholder="AGENCY_VN01" className={INPUT_CLS} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {isVi ? 'Hoa hồng (%)' : 'Commission (%)'}
        </label>
        <input type="number" min={1} max={80} value={commissionRatePct} onChange={(e) => setCommissionRatePct(Number(e.target.value))} className={INPUT_CLS} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {isVi ? 'Kênh chi trả chuẩn' : 'Primary Payout Rail'}
        </label>
        <select value={payoutRail} onChange={(e) => setPayoutRail(e.target.value as 'VIETQR' | 'USDT')} className={INPUT_CLS}>
          <option value="VIETQR">VietQR (NAPAS 247 / PayOS)</option>
          <option value="USDT">USDT (TRC-20 NOWPayments)</option>
        </select>
      </div>
      {isVietQr ? (
        <>
          <input type="text" required value={bankBin} onChange={(e) => setBankBin(e.target.value)} placeholder="NAPAS BIN (970422)" className={INPUT_CLS} />
          <input type="text" required value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="Bank Account Number" className={INPUT_CLS} />
          <input type="text" required value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Account Holder Name" className={INPUT_CLS} />
        </>
      ) : (
        <div className="sm:col-span-3">
          <input type="text" required value={usdtAddress} onChange={(e) => setUsdtAddress(e.target.value)} placeholder="USDT TRC-20 Wallet Address (T...)" className={INPUT_CLS} />
        </div>
      )}
      {errorMsg && <p className="text-xs font-medium text-destructive sm:col-span-3">{errorMsg}</p>}
      <div className="sm:col-span-3 flex justify-end">
        <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {isVi ? '+ Tuyển CTV vào Workspace' : '+ Recruit Workspace Partner'}
        </button>
      </div>
    </form>
  );
}
