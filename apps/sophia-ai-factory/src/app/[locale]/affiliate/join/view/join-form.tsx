// i18n-namespace: affiliateProgram

/**
 * Sign-up form for the public affiliate join page.
 *
 * The visitor supplies one thing: acceptance of the terms. Everything that
 * identifies or prices the partner is resolved server-side, so the form cannot
 * be used to choose a commission rate or claim a partner code.
 *
 * @module app/[locale]/affiliate/join/view/join-form
 */

'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { affiliateSelfSignupAction } from '@/forest/actions/affiliate-self-signup';

export interface JoinFormProps {
  /** True when the visitor is signed in; otherwise they are sent to login first. */
  isSignedIn: boolean;
  loginHref: string;
  termsHref: string;
  t: (key: string) => string;
}

type Outcome =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'created'; referralLink: string }
  | { kind: 'already_partner' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

export function JoinForm({ isSignedIn, loginHref, termsHref, t }: JoinFormProps) {
  const [accepted, setAccepted] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) {
      setOutcome({ kind: 'error', message: t('join.form.termsRequired') });
      return;
    }

    setOutcome({ kind: 'submitting' });
    const result = await affiliateSelfSignupAction({ acceptTerms: true as const });

    if (result.success && result.referralLink) {
      setOutcome({ kind: 'created', referralLink: result.referralLink });
      return;
    }

    if (result.status === 'already_partner') {
      setOutcome({ kind: 'already_partner' });
      return;
    }
    if (result.status === 'unauthorized') {
      setOutcome({ kind: 'unauthorized' });
      return;
    }
    setOutcome({ kind: 'error', message: result.error ?? t('join.form.genericError') });
  }

  if (outcome.kind === 'created') {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6 space-y-3">
        <h3 className="text-lg font-bold text-emerald-400">{t('join.form.successTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('join.form.successBody')}</p>
        <code className="block rounded-md bg-muted px-3 py-2 text-sm break-all">{outcome.referralLink}</code>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6 space-y-5">
      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span>
          {t('join.form.termsPrefix')}{' '}
          <a href={termsHref} className="text-primary-400 underline hover:text-primary-300">
            {t('join.form.termsLink')}
          </a>
        </span>
      </label>

      {outcome.kind === 'already_partner' && (
        <p role="status" className="text-sm text-amber-400">{t('join.form.alreadyPartner')}</p>
      )}
      {outcome.kind === 'unauthorized' && (
        <p role="status" className="text-sm text-amber-400">{t('join.form.signInRequired')}</p>
      )}
      {outcome.kind === 'error' && (
        <p role="alert" className="text-sm text-red-400">{outcome.message}</p>
      )}

      {isSignedIn ? (
        <button
          type="submit"
          disabled={!accepted || outcome.kind === 'submitting'}
          className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-6 py-3 font-semibold text-white shadow-lg transition-shadow hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
        >
          {outcome.kind === 'submitting' && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />}
          {t('join.form.submit')}
        </button>
      ) : (
        <a
          href={loginHref}
          className="block w-full rounded-lg border border-border px-6 py-3 text-center font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {t('join.form.signInFirst')}
        </a>
      )}

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        {t('join.form.privacyNote')}
      </p>
    </form>
  );
}
