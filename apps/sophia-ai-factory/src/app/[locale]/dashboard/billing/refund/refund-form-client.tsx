'use client';

/**
 * RefundFormClient — self-serve refund request form accessible from the billing dashboard.
 *
 * Reads refund policy from @/config/refund-policy (single source of truth).
 * Calls existing POST /api/refund-requests/create route.
 * Bilingual via next-intl t().
 *
 * @module app/[locale]/dashboard/billing/refund/refund-form-client
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Label } from '@/seed/components/ui/label';
import { Input } from '@/seed/components/ui/input';
import { Textarea } from '@/seed/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/seed/components/ui/select';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { DEFAULT_REFUND_WINDOW_DAYS } from '@/config/refund-policy';

// ---------------------------------------------------------------------------
// Reason options (keys resolved via t())
// ---------------------------------------------------------------------------
const REASON_KEYS = [
  'reason_not_working',
  'reason_not_as_described',
  'reason_duplicate',
  'reason_changed_mind',
  'reason_other',
] as const;

type SubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; refundId: string }
  | { status: 'error'; message: string };

interface RefundApiResponse {
  refundId?: string;
  error?: string;
  message?: string;
}

export function RefundFormClient() {
  const t = useTranslations('dashboard.billing.refund');

  const [purchaseId, setPurchaseId] = useState('');
  const [reasonKey, setReasonKey] = useState('');
  const [details, setDetails] = useState('');
  const [wallet, setWallet] = useState('');
  const [state, setState] = useState<SubmitState>({ status: 'idle' });

  const fullReason = reasonKey
    ? `[${t(reasonKey as Parameters<typeof t>[0])}] ${details}`.trim()
    : details;

  const isValid =
    purchaseId.trim().length >= 3 &&
    reasonKey !== '' &&
    details.trim().length >= 5 &&
    wallet.trim().length >= 10;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;

    setState({ status: 'loading' });

    try {
      const res = await fetch('/api/refund-requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchaseId.trim(),
          reason: fullReason,
          customerWalletAddress: wallet.trim(),
        }),
      });

      const data = (await res.json()) as RefundApiResponse;

      if (res.ok && data.refundId) {
        setState({ status: 'success', refundId: data.refundId });
      } else if (res.status === 422) {
        setState({ status: 'error', message: t('error_window_expired') });
      } else if (res.status === 409) {
        setState({ status: 'error', message: t('error_already_requested') });
      } else if (res.status === 404) {
        setState({ status: 'error', message: t('error_purchase_not_found') });
      } else {
        setState({ status: 'error', message: data.error ?? t('error_generic') });
      }
    } catch {
      setState({ status: 'error', message: t('error_network') });
    }
  }

  if (state.status === 'success') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">{t('success_title')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('success_body')}</p>
              <p className="text-xs font-mono text-muted-foreground mt-2">
                {t('success_refund_id')}: {state.refundId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('formTitle')}</CardTitle>
        <CardDescription>
          {t('formSubtitle', { days: DEFAULT_REFUND_WINDOW_DAYS })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Purchase ID */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-purchase-id">{t('label_purchase_id')}</Label>
            <Input
              id="refund-purchase-id"
              value={purchaseId}
              onChange={(e) => setPurchaseId(e.target.value)}
              placeholder={t('placeholder_purchase_id')}
              required
              minLength={3}
              disabled={state.status === 'loading'}
            />
            <p className="text-xs text-muted-foreground">{t('hint_purchase_id')}</p>
          </div>

          {/* Reason dropdown */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason-select">{t('label_reason')}</Label>
            <Select
              value={reasonKey}
              onValueChange={setReasonKey}
              disabled={state.status === 'loading'}
            >
              <SelectTrigger id="refund-reason-select">
                <SelectValue placeholder={t('placeholder_reason')} />
              </SelectTrigger>
              <SelectContent>
                {REASON_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Details textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-details">{t('label_details')}</Label>
            <Textarea
              id="refund-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t('placeholder_details')}
              required
              minLength={5}
              maxLength={1000}
              rows={4}
              disabled={state.status === 'loading'}
            />
          </div>

          {/* Wallet address */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-wallet">{t('label_wallet')}</Label>
            <Input
              id="refund-wallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder={t('placeholder_wallet')}
              required
              minLength={10}
              maxLength={200}
              disabled={state.status === 'loading'}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{t('hint_wallet')}</p>
          </div>

          {/* Crypto warning */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-3">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-amber-700 dark:text-amber-300">{t('crypto_warning')}</p>
          </div>

          {/* Error display */}
          {state.status === 'error' && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-destructive">{state.message}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={!isValid || state.status === 'loading'}
            className="w-full"
          >
            {state.status === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
