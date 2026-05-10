/**
 * Client form for multi-channel video distribution.
 * Renders channel checkboxes, caption textarea, schedule picker.
 *
 * @module app/[locale]/dashboard/videos/[id]/distribute/distribute-panel
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { UserChannel } from '@/seed/db/get-user-channels';
import { PROVIDER_LABELS } from './channel-meta';

interface Props {
  videoId: string;
  channels: UserChannel[];
}

interface DistributeResponse {
  jobIds?: string[];
  error?: string;
  missingProviders?: string[];
}

export function DistributePanel({ videoId, channels }: Props) {
  const t = useTranslations('dashboard.videos.distribute');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeChannels = channels.filter((c) => c.status === 'active');
  const inactiveChannels = channels.filter((c) => c.status !== 'active');

  function toggleChannel(provider: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selected.size === 0) {
      setError(t('errors.noChannelSelected'));
      return;
    }

    // Convert datetime-local to epoch seconds
    let scheduledAtEpoch: number | undefined;
    if (scheduledAt) {
      scheduledAtEpoch = Math.floor(new Date(scheduledAt).getTime() / 1000);
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/videos/${videoId}/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelProviders: Array.from(selected),
          caption: caption.trim() || undefined,
          scheduledAt: scheduledAtEpoch,
        }),
      });

      const data = (await res.json()) as DistributeResponse;

      if (!res.ok) {
        setError(data.error ?? t('errors.submitFailed'));
        return;
      }

      const count = data.jobIds?.length ?? selected.size;
      toast.success(t('successToast', { count }));
      // Navigate back to video detail with success signal
      startTransition(() => {
        router.push(`/dashboard/videos/${videoId}?distributed=${count}`);
      });
    } catch {
      toast.error(t('errorToast'));
      setError(t('errors.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const busy = isSubmitting || isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Channel selection */}
      <section>
        <h2 className="text-sm font-medium mb-3">{t('selectChannels')}</h2>

        {activeChannels.length === 0 && inactiveChannels.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noChannels')}</p>
        )}

        <div className="space-y-2">
          {activeChannels.map((ch) => (
            <label
              key={ch.provider}
              className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent"
            >
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={selected.has(ch.provider)}
                onChange={() => toggleChannel(ch.provider)}
                disabled={busy}
              />
              <span className="text-sm font-medium">
                {PROVIDER_LABELS[ch.provider] ?? ch.provider}
              </span>
              {ch.display_name && (
                <span className="text-xs text-muted-foreground ml-auto">{ch.display_name}</span>
              )}
            </label>
          ))}

          {inactiveChannels.map((ch) => (
            <div
              key={ch.provider}
              className="flex items-center gap-3 rounded-md border p-3 opacity-50"
              title={t('connectFirst')}
            >
              <input type="checkbox" className="h-4 w-4" disabled />
              <span className="text-sm font-medium">
                {PROVIDER_LABELS[ch.provider] ?? ch.provider}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{t('channelNotActive')}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Caption */}
      <section>
        <label className="block text-sm font-medium mb-2" htmlFor="caption">
          {t('caption')}
        </label>
        <textarea
          id="caption"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
          placeholder={t('captionPlaceholder')}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={2200}
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {caption.length}/2200
        </p>
      </section>

      {/* Schedule */}
      <section>
        <label className="block text-sm font-medium mb-2" htmlFor="scheduledAt">
          {t('scheduleAt')}
        </label>
        <input
          id="scheduledAt"
          type="datetime-local"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          placeholder={t('scheduleNow')}
          disabled={busy}
        />
        {!scheduledAt && (
          <p className="text-xs text-muted-foreground mt-1">{t('scheduleNow')}</p>
        )}
      </section>

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 min-h-[44px]"
          disabled={busy || selected.size === 0}
        >
          {busy ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
}
