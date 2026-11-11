/**
 * Inline BYOK YouTube Channel Registration Form ($0.00 Self-Serve)
 *
 * Allows a customer to register their YouTube channel (`externalAccountId`,
 * `displayName`, `accessToken`, `refreshToken`) directly into `publishing_channels`
 * via `POST /api/publish/channels` without requiring operator-managed Google OAuth.
 *
 * @module components/niche-studio/niche-gate1-channel-inline-form
 */

// i18n-namespace: nicheStudio
'use client';

import React, { useState } from 'react';

interface NicheGate1ChannelInlineFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}

const INPUT_CLASS =
  'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500';

export function NicheGate1ChannelInlineForm({
  onSuccess,
  onCancel,
  t,
}: NicheGate1ChannelInlineFormProps) {
  const [externalAccountId, setExternalAccountId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/publish/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'youtube',
          externalAccountId: externalAccountId.trim(),
          displayName: displayName.trim() || undefined,
          accessToken: accessToken.trim(),
          refreshToken: refreshToken.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setError(body.message || body.error || t('channelByokSaveError'));
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('channelByokSaveError'));
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 rounded-lg bg-zinc-950/90 border border-amber-500/30 space-y-2.5 text-[11px]"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-amber-200">{t('channelByokFormTitle')}</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-zinc-400 hover:text-white text-[10px]"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          required
          aria-label={t('channelByokIdPlaceholder')}
          placeholder={t('channelByokIdPlaceholder')}
          value={externalAccountId}
          onChange={(e) => setExternalAccountId(e.target.value)}
          className={INPUT_CLASS}
        />
        <input
          type="text"
          aria-label={t('channelByokNamePlaceholder')}
          placeholder={t('channelByokNamePlaceholder')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={INPUT_CLASS}
        />
        <input
          type="password"
          required
          aria-label={t('channelByokAccessTokenPlaceholder')}
          placeholder={t('channelByokAccessTokenPlaceholder')}
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          className={INPUT_CLASS}
        />
        <input
          type="password"
          aria-label={t('channelByokRefreshTokenPlaceholder')}
          placeholder={t('channelByokRefreshTokenPlaceholder')}
          value={refreshToken}
          onChange={(e) => setRefreshToken(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      {error && <p className="text-rose-400 text-[10px]">⚠️ {error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[11px] disabled:opacity-50"
        >
          {isSaving ? '...' : t('channelByokSaveBtn')}
        </button>
      </div>
    </form>
  );
}
