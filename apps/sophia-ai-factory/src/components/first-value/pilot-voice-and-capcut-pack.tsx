'use client';

/**
 * Pilot Free Edge TTS Voice-Over + CapCut/TikTok Ready Pack + Product Images Picker.
 *
 * Keeps `FirstValueMp4AffiliateCard` modular while giving MMO affiliates:
 * - 1-5 local product images (client-side ObjectURLs) for the 9:16 MP4 background
 * - Free Vietnamese/English Edge TTS voice-over (.mp3) via `/api/first-value/voice`
 * - Scene-timed `.srt` subtitles (`src/tree/subtitles/subtitle-formatter`)
 * - 1-click Copy Caption + Hashtag + Pinned Comment with active shortlink
 *
 * @module components/first-value/pilot-voice-and-capcut-pack
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import {
  buildCapCutPublishCopy,
  buildNarrationTextFromScript,
  buildSrtFromScript,
  triggerTextFileDownload,
} from './pilot-capcut-pack-helpers';

export interface PilotVoiceAndCapCutPackProps {
  readonly artifactId: string;
  readonly script: ScriptOutput;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
  readonly busy: boolean;
  readonly productImageUrls: readonly string[];
  readonly onProductImagesChange: (urls: readonly string[]) => void;
}

const VOICE_OPTIONS = [
  { id: 'vi-VN-HoaiMyNeural', locale: 'vi' as const, gender: 'female' as const, label: '🇻🇳 Hoài My (Nữ Miền Nam — Miễn phí)' },
  { id: 'vi-VN-NamMinhNeural', locale: 'vi' as const, gender: 'male' as const, label: '🇻🇳 Nam Minh (Nam Miền Bắc — Miễn phí)' },
  { id: 'en-US-JennyNeural', locale: 'en' as const, gender: 'female' as const, label: '🇺🇸 Jenny (English Female — Free)' },
] as const;

export function PilotVoiceAndCapCutPack(props: PilotVoiceAndCapCutPackProps) {
  const t = useTranslations('firstValue');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(VOICE_OPTIONS[0].id);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [copiedPack, setCopiedPack] = useState(false);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function handleSelectImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    const nextUrls = [...props.productImageUrls];
    for (const file of Array.from(files)) {
      if (nextUrls.length >= 5) break;
      if (!file.type.startsWith('image/')) continue;
      nextUrls.push(URL.createObjectURL(file));
    }
    props.onProductImagesChange(nextUrls);
  }

  function handleRemoveImage(index: number) {
    const target = props.productImageUrls[index];
    if (target) URL.revokeObjectURL(target);
    props.onProductImagesChange(props.productImageUrls.filter((_, idx) => idx !== index));
  }

  async function handleGenerateVoice() {
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const voiceOption =
        VOICE_OPTIONS.find((v) => v.id === selectedVoiceId) ?? VOICE_OPTIONS[0];
      const text = buildNarrationTextFromScript(props.script, props.ctaText);
      const response = await fetch('/api/first-value/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          locale: voiceOption.locale,
          gender: voiceOption.gender,
          voice: voiceOption.id,
          filename: `sophia-voice-${props.artifactId}`,
        }),
      });
      if (!response.ok) {
        setVoiceError(t('pilotVoiceError'));
        return;
      }
      const blob = await response.blob();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const nextUrl = URL.createObjectURL(blob);
      setAudioUrl(nextUrl);
    } catch {
      setVoiceError(t('pilotVoiceError'));
    } finally {
      setVoiceLoading(false);
    }
  }

  function handleDownloadSrt() {
    const srt = buildSrtFromScript(props.script, props.ctaText);
    triggerTextFileDownload(
      `sophia-subtitles-${props.artifactId}.srt`,
      srt,
      'application/x-subrip;charset=utf-8',
    );
  }

  async function handleCopyCapCutPack() {
    const copyText = buildCapCutPublishCopy({
      script: props.script,
      ctaText: props.ctaText,
      shortUrl: props.shortUrl,
      disclosureTag: props.disclosureTag,
    });
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopiedPack(true);
      setTimeout(() => setCopiedPack(false), 2000);
    } catch {
      // Ignore clipboard failure in restricted browser contexts
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
      {/* 1. Product Images for MP4 background */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            {t('pilotProductImagesTitle')}
          </span>
          <label className="cursor-pointer rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:opacity-90">
            {t('pilotProductImagesBtn')}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={props.busy || props.productImageUrls.length >= 5}
              onChange={(e) => handleSelectImages(e.target.files)}
              className="hidden"
            />
          </label>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{t('pilotProductImagesHint')}</p>
        {props.productImageUrls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {props.productImageUrls.map((url, idx) => (
              <div
                key={url}
                className="relative h-14 w-10 overflow-hidden rounded border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Product ${idx + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  aria-label="Remove image"
                  className="absolute right-0 top-0 bg-black/70 px-1 text-[10px] text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Free Edge TTS Voice-Over */}
      <div className="border-t border-border pt-3">
        <div className="text-xs font-semibold text-foreground">{t('pilotFreeVoiceTitle')}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={selectedVoiceId}
            disabled={props.busy || voiceLoading}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="pilot-generate-voice-btn"
            disabled={props.busy || voiceLoading}
            onClick={() => void handleGenerateVoice()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {voiceLoading ? t('loading') : t('pilotGenerateVoiceBtn')}
          </button>
          {audioUrl && (
            <a
              href={audioUrl}
              download={`sophia-voice-${props.artifactId}.mp3`}
              className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:opacity-90"
            >
              {t('pilotDownloadVoiceBtn')}
            </a>
          )}
        </div>
        {voiceError && <p className="mt-1 text-xs text-destructive">{voiceError}</p>}
        {audioUrl && (
          <audio controls src={audioUrl} className="mt-2 h-9 w-full max-w-md" />
        )}
      </div>

      {/* 3. CapCut / TikTok Ready Pack (.srt + 1-click Caption & Pinned Comment) */}
      <div className="border-t border-border pt-3">
        <div className="text-xs font-semibold text-foreground">{t('pilotCapCutPackTitle')}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="pilot-download-srt-btn"
            onClick={handleDownloadSrt}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {t('pilotDownloadSrtBtn')}
          </button>
          <button
            type="button"
            data-testid="pilot-copy-capcut-pack-btn"
            onClick={() => void handleCopyCapCutPack()}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {copiedPack ? t('copiedBtn') : t('pilotCopyCapCutPackBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
