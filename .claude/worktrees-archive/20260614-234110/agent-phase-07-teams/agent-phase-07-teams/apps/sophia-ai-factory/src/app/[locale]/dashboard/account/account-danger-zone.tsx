"use client";

/**
 * Danger Zone — account self-delete with double-confirm + 7-day cooldown.
 * Wave 21 Phase 02.
 *
 * Stage flow:
 *   1. User types DELETE → button enabled → POST /api/account/delete/request
 *   2. Email sent → "check your inbox" banner shown
 *   3. User clicks email link → confirmed_at set → 7d cooldown begins
 *   4. UI shows "scheduled for <date>" + Cancel button
 *   5. User can POST /api/account/delete/request {action:'cancel'} any time
 *      before scheduled_at to abort
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'pending' }
  | { kind: 'confirmed'; scheduledAt: number }
  | { kind: 'cancelled' };

type ActionStatus = 'idle' | 'sending' | 'sent' | 'cancelling' | 'error';

export function AccountDangerZone() {
  const t = useTranslations('account');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [typed, setTyped] = useState('');
  const [action, setAction] = useState<ActionStatus>('idle');

  async function refreshStatus() {
    try {
      const res = await fetch('/api/account/delete/status');
      if (!res.ok) {
        setState({ kind: 'idle' });
        return;
      }
      const body = (await res.json()) as {
        state: 'none' | 'pending' | 'confirmed' | 'cancelled';
        scheduledAt?: number;
      };
      if (body.state === 'pending') setState({ kind: 'pending' });
      else if (body.state === 'confirmed' && body.scheduledAt) {
        setState({ kind: 'confirmed', scheduledAt: body.scheduledAt });
      } else if (body.state === 'cancelled') setState({ kind: 'cancelled' });
      else setState({ kind: 'idle' });
    } catch {
      setState({ kind: 'idle' });
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function handleRequest() {
    if (typed.trim() !== t('delete_typed_word')) return;
    setAction('sending');
    try {
      const res = await fetch('/api/account/delete/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request' }),
      });
      if (!res.ok) {
        setAction('error');
        return;
      }
      setAction('sent');
      setTyped('');
      await refreshStatus();
    } catch {
      setAction('error');
    }
  }

  async function handleCancel() {
    setAction('cancelling');
    try {
      const res = await fetch('/api/account/delete/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) {
        setAction('error');
        return;
      }
      setAction('idle');
      await refreshStatus();
    } catch {
      setAction('error');
    }
  }

  const typedMatches = typed.trim() === t('delete_typed_word');

  return (
    <div
      data-testid="account-danger-zone"
      className="border-t border-red-200 dark:border-red-900 pt-6 space-y-3"
    >
      <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
        {t('danger_section')}
      </h3>
      <p className="text-xs text-muted-foreground">{t('delete_description')}</p>

      {state.kind === 'pending' && (
        <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
          {t('delete_status_pending')}
        </p>
      )}

      {state.kind === 'confirmed' && (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
            {t('delete_status_confirmed', {
              date: new Date(state.scheduledAt * 1000).toLocaleDateString(),
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={action === 'cancelling'}
            className="cursor-pointer"
          >
            {action === 'cancelling' ? t('delete_cancel_pending') : t('delete_cancel_btn')}
          </Button>
        </div>
      )}

      {state.kind === 'cancelled' && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          {t('delete_status_cancelled')}
        </p>
      )}

      {(state.kind === 'idle' || state.kind === 'cancelled') && action !== 'sent' && (
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="delete-typed" className="text-xs">
            {t('delete_typed_label')}
          </Label>
          <Input
            id="delete-typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={20}
            autoComplete="off"
          />
          <Button
            type="button"
            variant="destructive"
            onClick={handleRequest}
            disabled={!typedMatches || action === 'sending'}
            className="cursor-pointer"
          >
            {action === 'sending' ? t('delete_request_pending') : t('delete_btn')}
          </Button>
        </div>
      )}

      {action === 'sent' && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">
          {t('delete_request_sent')}
        </p>
      )}

      {action === 'error' && (
        <p className="text-xs text-red-500" role="alert">
          {t('delete_error')}
        </p>
      )}
    </div>
  );
}
