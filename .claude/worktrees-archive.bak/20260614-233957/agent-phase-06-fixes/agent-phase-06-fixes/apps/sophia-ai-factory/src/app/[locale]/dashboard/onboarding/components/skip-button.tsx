'use client';

/**
 * SkipButton — client component.
 * Calls completeOnboardingAction(reason:'skip') then navigates to /dashboard.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboardingAction } from '@/app/actions/complete-onboarding-action';

interface SkipButtonProps {
  label: string;
}

export function SkipButton({ label }: SkipButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSkip() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction({ reason: 'skip' });
      if (result.success) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(result.error ?? 'unknown_error');
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleSkip}
        disabled={isPending}
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors disabled:opacity-50"
        type="button"
        aria-label={label}
      >
        {isPending ? '...' : label}
      </button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
