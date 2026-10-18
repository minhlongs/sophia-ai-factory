/**
 * Acceptance Client Submodule: Sign-off Form Card.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/signoff-form-card
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, ShieldCheck } from 'lucide-react';
import { Card } from '@/seed/components/ui/card';
import { cn } from '@/seed/utils/cn';
import { SignoffCheckpointsList } from './signoff-checkpoints-list';
import { SignoffSignerInputs } from './signoff-signer-inputs';

interface SignoffFormCardProps {
  signError: string | null;
  confirmedStatements: Record<number, boolean>;
  onCheckboxToggle: (idx: number) => void;
  signerName: string; setSignerName: (name: string) => void;
  signerRole: string; setSignerRole: (role: string) => void;
  signerEmail: string; setSignerEmail: (email: string) => void;
  legalConsent: boolean; setLegalConsent: (consent: boolean) => void;
  canSubmit: boolean;
  isSigning: boolean;
  onSignAcceptance: (e: React.FormEvent) => Promise<void>;
}

export function SignoffFormCard({
  signError, confirmedStatements, onCheckboxToggle,
  signerName, setSignerName, signerRole, setSignerRole,
  signerEmail, setSignerEmail, legalConsent, setLegalConsent,
  canSubmit, isSigning, onSignAcceptance,
}: SignoffFormCardProps) {
  const t = useTranslations('handover');

  return (
    <Card className="p-6 sm:p-8 border-primary/30 shadow-md bg-card">
      <div className="mb-6 border-b border-border/50 pb-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          {t('signOff.title')}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl">
          {t('signOff.description')}
        </p>
      </div>

      {signError && (
        <div className="p-4 mb-6 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{signError}</span>
        </div>
      )}

      <form onSubmit={onSignAcceptance} className="space-y-6">
        <SignoffCheckpointsList
          confirmedStatements={confirmedStatements}
          onCheckboxToggle={onCheckboxToggle}
        />

        <SignoffSignerInputs
          signerName={signerName}
          setSignerName={setSignerName}
          signerRole={signerRole}
          setSignerRole={setSignerRole}
          signerEmail={signerEmail}
          setSignerEmail={setSignerEmail}
        />

        <button
          type="button"
          role="checkbox"
          aria-checked={legalConsent}
          onClick={() => setLegalConsent(!legalConsent)}
          className="w-full text-left p-3.5 rounded-lg bg-muted/40 border border-border flex items-start gap-3 cursor-pointer"
        >
          <div
            className={cn(
              'w-5 h-5 rounded mt-0.5 flex items-center justify-center border transition-all shrink-0',
              legalConsent
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-muted-foreground/40 bg-background',
            )}
          >
            {legalConsent && <Check className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs text-muted-foreground leading-relaxed">
            {t('signOff.form.confirmCheckbox')}
          </span>
        </button>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold shadow-md transition-all',
              canSubmit
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.01]'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60',
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            {isSigning ? t('signOff.form.signing') : t('signOff.form.submitButton')}
          </button>
        </div>
      </form>
    </Card>
  );
}
