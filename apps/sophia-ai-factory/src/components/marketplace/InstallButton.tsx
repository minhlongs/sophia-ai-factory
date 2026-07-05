'use client';

/**
 * InstallButton — triggers SOP installation from the marketplace card grid.
 *
 * Uses useActionState to wrap the installSop Server Action.
 * For paid SOPs (priceCents > 0), shows a confirmation prompt before installing.
 * Displays loading state, success confirmation, and inline error messages.
 */

import { useTranslations } from 'next-intl';
import { useActionState, useEffect } from 'react';
import { installSop } from '@/land/sop-marketplace';

/** Shape returned by the useActionState reducer */
type InstallState = Record<string, unknown> | null;

interface InstallButtonProps {
  listingId: string;
  priceCents: number;
  disabled?: boolean;
  /** Called when installation succeeds */
  onInstalled?: () => void;
}

export function InstallButton({
  listingId,
  priceCents,
  disabled,
  onInstalled,
}: InstallButtonProps) {
  const t = useTranslations('marketplace.creator');

  const [state, formAction, isPending] = useActionState<InstallState, FormData>(
    async (_prev) => {
      if (priceCents > 0) {
        const price = `$${(priceCents / 100).toFixed(2)}`;
        if (!confirm(t('installConfirm', { price }))) {
          return null;
        }
      }
      const result = await installSop(listingId);
      return (result ?? null) as InstallState;
    },
    null,
  );

  const err: string | undefined =
    state && 'error' in state
      ? typeof (state as Record<string, unknown>).error === 'string'
        ? ((state as Record<string, unknown>).error as string)
        : undefined
      : undefined;

  const installationId: string | undefined =
    state && 'installationId' in state
      ? ((state as Record<string, unknown>).installationId as string)
      : undefined;

  const installed = !!installationId;

  useEffect(() => {
    if (installed && onInstalled) {
      onInstalled();
    }
  }, [installed, onInstalled]);

  // ── Render ────────────────────────────────────────────────────────

  if (installed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-500">
        {t('installSuccess')} &#10003;
      </span>
    );
  }

  const buttonLabel =
    priceCents > 0
      ? `${t('install')} $${(priceCents / 100).toFixed(2)}`
      : t('install');

  return (
    <div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={disabled || isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 min-h-9"
        >
          {isPending ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {t('install')}...
            </>
          ) : (
            buttonLabel
          )}
        </button>
      </form>
      {err && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {err === 'ALREADY_INSTALLED'
            ? t('alreadyInstalled')
            : err === 'INSTALL_LIMIT_REACHED'
              ? t('installLimitReached')
              : t('installError', { error: err })}
        </p>
      )}
    </div>
  );
}
