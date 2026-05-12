'use client';

/**
 * ByokHelpTip — inline collapsible guide for non-tech users.
 * Shown below each API key input in the Setup Wizard.
 * Props: provider ('openrouter' | 'elevenlabs' | 'd-id')
 *
 * Screenshot images are OPTIONAL placeholders — if the PNG doesn't exist
 * the img element simply fails silently (hidden via onError state).
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type ByokProvider = 'openrouter' | 'elevenlabs' | 'd-id';

interface ByokHelpTipProps {
  provider: ByokProvider;
}

/** Returns the i18n sub-key for a given provider (d-id → dId for JSON key). */
function providerKey(provider: ByokProvider): string {
  if (provider === 'd-id') return 'dId';
  return provider;
}

type HelpKeys = 'openrouter.title' | 'openrouter.step1' | 'openrouter.step2' | 'openrouter.step3' | 'openrouter.signupUrl'
  | 'elevenlabs.title' | 'elevenlabs.step1' | 'elevenlabs.step2' | 'elevenlabs.step3' | 'elevenlabs.signupUrl'
  | 'dId.title' | 'dId.step1' | 'dId.step2' | 'dId.step3' | 'dId.signupUrl'
  | 'toggleShow' | 'toggleHide';

export function ByokHelpTip({ provider }: ByokHelpTipProps) {
  const t = useTranslations('onboarding.byok.help');
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const pKey = providerKey(provider);
  const imageSrc = `/byok-guide/${provider}.png`;

  return (
    <div className="mt-1 rounded-lg border border-border bg-muted/30 text-sm">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <span className="font-medium text-xs">
          {open ? t('toggleHide' as HelpKeys) : t('toggleShow' as HelpKeys)}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
      </button>

      {/* Accordion content */}
      {open && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          <p className="font-semibold text-xs text-foreground">
            {t(`${pKey}.title` as HelpKeys)}
          </p>

          {/* 3-step guide */}
          <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
            <li>{t(`${pKey}.step1` as HelpKeys)}</li>
            <li>{t(`${pKey}.step2` as HelpKeys)}</li>
            <li>{t(`${pKey}.step3` as HelpKeys)}</li>
          </ol>

          {/* Official signup link */}
          <a
            href={t(`${pKey}.signupUrl` as HelpKeys)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            {t(`${pKey}.signupUrl` as HelpKeys)}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>

          {/* Screenshot — hidden if PNG not yet uploaded */}
          {!imgError && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={`${provider} key screenshot guide`}
              className="mt-2 w-full max-h-28 object-cover object-top rounded-md border border-border"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          )}
        </div>
      )}
    </div>
  );
}
