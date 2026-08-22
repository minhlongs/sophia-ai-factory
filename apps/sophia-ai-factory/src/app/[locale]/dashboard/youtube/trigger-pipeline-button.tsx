/**
 * Trigger pipeline button — client component that calls the
 * triggerContentPipelineAction server action and refreshes the page.
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Play, Loader2 } from 'lucide-react';
import { triggerContentPipelineAction } from '@/land/youtube/actions';

interface TriggerPipelineButtonProps {
  channelConfigId: string;
}

export function TriggerPipelineButton({ channelConfigId }: TriggerPipelineButtonProps) {
  const t = useTranslations('youtube');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrigger = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await triggerContentPipelineAction({ channelConfigId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.value.triggered) {
        setMessage(t('triggered'));
        router.refresh();
      } else {
        setMessage(result.value.reason ?? t('notTriggered'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('triggerError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={handleTrigger}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {busy ? t('triggering') : t('triggerPipeline')}
      </button>
      {message && <p className="mt-2 text-xs text-emerald-600">{message}</p>}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}