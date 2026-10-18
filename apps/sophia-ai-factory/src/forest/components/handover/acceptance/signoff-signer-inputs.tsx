/**
 * Acceptance Client Submodule: Sign-off Signer Inputs Grid.
 * Layer: forest/components (UI presentation)
 *
 * @module forest/components/handover/acceptance/signoff-signer-inputs
 */

import React from 'react';
import { useTranslations } from 'next-intl';

export interface SignoffSignerInputsProps {
  signerName: string;
  setSignerName: (name: string) => void;
  signerRole: string;
  setSignerRole: (role: string) => void;
  signerEmail: string;
  setSignerEmail: (email: string) => void;
}

export function SignoffSignerInputs({
  signerName,
  setSignerName,
  signerRole,
  setSignerRole,
  signerEmail,
  setSignerEmail,
}: SignoffSignerInputsProps) {
  const t = useTranslations('handover');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
      <div>
        <label htmlFor="signer-name-input" className="text-xs font-semibold text-foreground block mb-1.5">
          {t('signOff.form.nameLabel')} <span className="text-destructive">*</span>
        </label>
        <input
          id="signer-name-input"
          type="text"
          required
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder={t('signOff.form.namePlaceholder')}
          className="w-full px-3.5 py-2 rounded-lg text-sm bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>

      <div>
        <label htmlFor="signer-role-input" className="text-xs font-semibold text-foreground block mb-1.5">
          {t('signOff.form.roleLabel')} <span className="text-destructive">*</span>
        </label>
        <input
          id="signer-role-input"
          type="text"
          required
          value={signerRole}
          onChange={(e) => setSignerRole(e.target.value)}
          placeholder={t('signOff.form.rolePlaceholder')}
          className="w-full px-3.5 py-2 rounded-lg text-sm bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>

      <div>
        <label htmlFor="signer-email-input" className="text-xs font-semibold text-foreground block mb-1.5">
          {t('signOff.form.emailLabel')} <span className="text-destructive">*</span>
        </label>
        <input
          id="signer-email-input"
          type="email"
          required
          value={signerEmail}
          onChange={(e) => setSignerEmail(e.target.value)}
          placeholder={t('signOff.form.emailPlaceholder')}
          className="w-full px-3.5 py-2 rounded-lg text-sm bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>
    </div>
  );
}
