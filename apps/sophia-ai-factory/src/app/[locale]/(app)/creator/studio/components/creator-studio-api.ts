/**
 * API client helpers for Creator Studio template and withdrawal submissions.
 */

import type { TemplateFormData, WithdrawFormData, ActiveQrModalState } from './types';
import { NAPAS_BANKS } from './constants';

export async function postCreatorTemplate(templateForm: TemplateFormData): Promise<void> {
  const priceCents = Math.round(parseFloat(templateForm.priceDollars || '0') * 100);
  const res = await fetch('/api/creator/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: templateForm.title,
      description: templateForm.description || undefined,
      niche: templateForm.niche,
      targetPlatform: templateForm.targetPlatform,
      aspectRatio: templateForm.aspectRatio,
      hookStyle: templateForm.hookStyle,
      scriptTemplate: templateForm.scriptTemplate,
      visualStylePrompt: templateForm.visualStylePrompt,
      musicPrompt: templateForm.musicPrompt || undefined,
      priceCents,
    }),
  });

  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error || 'Failed to submit template');
  }
}

export async function postCreatorWithdrawal(
  withdrawForm: WithdrawFormData,
): Promise<ActiveQrModalState | null> {
  const amountCents = Math.round(parseFloat(withdrawForm.amountDollars || '0') * 100);
  const res = await fetch('/api/creator/withdrawals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amountCents,
      rail: withdrawForm.rail,
      destinationAddress: withdrawForm.rail === 'USDT' ? withdrawForm.destinationAddress : undefined,
      bankBin: withdrawForm.rail === 'VIETQR' ? withdrawForm.bankBin : undefined,
      bankAccountNumber: withdrawForm.rail === 'VIETQR' ? withdrawForm.bankAccountNumber : undefined,
      bankAccountName: withdrawForm.rail === 'VIETQR' ? withdrawForm.bankAccountName : undefined,
    }),
  });

  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error || 'Withdrawal failed');
  }

  const result = (await res.json()) as {
    vietQr?: { qrUrl: string; amountVnd: number; amountUsd: number } | null;
  };

  if (!result.vietQr) return null;

  return {
    qrUrl: result.vietQr.qrUrl,
    amountVnd: result.vietQr.amountVnd,
    amountUsd: result.vietQr.amountUsd,
    bankName: NAPAS_BANKS.find((b) => b.bin === withdrawForm.bankBin)?.short || 'NAPAS',
    accountNumber: withdrawForm.bankAccountNumber,
  };
}
