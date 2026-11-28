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

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import { getCsrfHeaders } from '@/seed/security/use-csrf-token';
import {
  buildCapCutPublishCopy,
  buildNarrationTextFromScript,
  buildSrtFromScript,
  extractThreeShortClipsFromLongScript,
  triggerTextFileDownload,
  type RepurposedShortClip,
} from './pilot-capcut-pack-helpers';
import { checkBrowserAacEncoderSupport } from './pilot-browser-audio-encoder';
import {
  renderAndDownloadPilotMp4,
  renderNarratedPilotMp4Blob,
} from './pilot-browser-mp4-renderer';

export interface PilotVoiceAndCapCutPackProps {
  readonly orgId?: string;
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
  { id: 'nova', locale: 'vi' as const, gender: 'female' as const, label: 'OpenRouter Nova (Nữ — BYOK openai/gpt-4o-mini-tts)' },
  { id: 'onyx', locale: 'vi' as const, gender: 'male' as const, label: 'OpenRouter Onyx (Nam — BYOK openai/gpt-4o-mini-tts)' },
  { id: 'alloy', locale: 'en' as const, gender: 'female' as const, label: 'OpenRouter Alloy (Neutral — BYOK openai/gpt-4o-mini-tts)' },
] as const;

export function PilotVoiceAndCapCutPack(props: PilotVoiceAndCapCutPackProps) {
  const t = useTranslations('firstValue');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(VOICE_OPTIONS[0].id);
  const [voiceTargetMode, setVoiceTargetMode] = useState<'narrated_mp4' | 'mp3_only'>('narrated_mp4');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [narratedLoading, setNarratedLoading] = useState(false);
  const [narratedError, setNarratedError] = useState<string | null>(null);
  const [narratedVideoUrl, setNarratedVideoUrl] = useState<string | null>(null);
  const [copiedPack, setCopiedPack] = useState(false);
  const [renderingClipIdx, setRenderingClipIdx] = useState<number | null>(null);
  const repurposedClips = extractThreeShortClipsFromLongScript(props.script);

  async function handleExportRepurposedClip(clip: RepurposedShortClip) {
    setRenderingClipIdx(clip.clipIndex);
    try {
      await renderAndDownloadPilotMp4({
        artifactId: `${props.artifactId}-short-${clip.clipIndex}`,
        script: clip.script,
        ctaText: props.ctaText,
        shortUrl: props.shortUrl,
        disclosureTag: props.disclosureTag,
        productImageUrls: props.productImageUrls,
        aspectRatio: '9:16',
      });
    } finally {
      setRenderingClipIdx(null);
    }
  }

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (narratedVideoUrl) URL.revokeObjectURL(narratedVideoUrl);
    };
  }, [narratedVideoUrl]);

  const scriptFingerprint = `${props.orgId ?? ''}:${props.artifactId}:${props.script.title}:${props.ctaText}:${props.shortUrl}:${props.productImageUrls.join(',')}:${props.script.scenes.map((s) => s.narration).join('|')}`;
  const fingerprintRef = useRef(scriptFingerprint);
  const voiceSeqRef = useRef(0);
  const renderSeqRef = useRef(0);

  useEffect(() => {
    fingerprintRef.current = scriptFingerprint;
    voiceSeqRef.current += 1;
    renderSeqRef.current += 1;
    setAudioBlob(null);
    setAudioUrl(null);
    setNarratedVideoUrl(null);
    setNarratedError(null);
    setVoiceError(null);
  }, [scriptFingerprint]);

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
    const reqFingerprint = scriptFingerprint;
    const reqSeq = voiceSeqRef.current + 1;
    voiceSeqRef.current = reqSeq;
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      if (voiceTargetMode === 'narrated_mp4') {
        const support = await checkBrowserAacEncoderSupport();
        if (fingerprintRef.current !== reqFingerprint || voiceSeqRef.current !== reqSeq) return;
        if (!support.supported) {
          setVoiceError(
            support.reason ??
              'Trình duyệt không hỗ trợ mã hóa AAC-LC cho MP4 có giọng đọc. Hãy chọn chế độ chỉ tải .mp3.',
          );
          return;
        }
      }
      const voiceOption =
        VOICE_OPTIONS.find((v) => v.id === selectedVoiceId) ?? VOICE_OPTIONS[0];
      const text = buildNarrationTextFromScript(props.script, props.ctaText);
      const response = await fetch('/api/first-value/voice', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({
          ...(props.orgId ? { orgId: props.orgId } : {}),
          text,
          locale: voiceOption.locale,
          gender: voiceOption.gender,
          voice: voiceOption.id,
          filename: `sophia-voice-${props.artifactId}`,
        }),
      });
      if (fingerprintRef.current !== reqFingerprint || voiceSeqRef.current !== reqSeq) return;
      if (!response.ok) {
        setVoiceError(t('pilotVoiceError'));
        return;
      }
      const blob = await response.blob();
      if (fingerprintRef.current !== reqFingerprint || voiceSeqRef.current !== reqSeq) return;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const nextUrl = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(nextUrl);
      setNarratedVideoUrl(null);
      setNarratedError(null);
    } catch {
      if (fingerprintRef.current === reqFingerprint && voiceSeqRef.current === reqSeq) {
        setVoiceError(t('pilotVoiceError'));
      }
    } finally {
      if (fingerprintRef.current === reqFingerprint && voiceSeqRef.current === reqSeq) {
        setVoiceLoading(false);
      }
    }
  }

  async function handleRenderNarratedMp4() {
    if (!audioBlob || narratedLoading) return;
    const reqFingerprint = scriptFingerprint;
    const reqSeq = renderSeqRef.current + 1;
    renderSeqRef.current = reqSeq;
    setNarratedLoading(true);
    setNarratedError(null);
    try {
      const audioBytes = await audioBlob.arrayBuffer();
      if (fingerprintRef.current !== reqFingerprint || renderSeqRef.current !== reqSeq) return;
      const { blob } = await renderNarratedPilotMp4Blob({
        artifactId: props.artifactId,
        script: props.script,
        ctaText: props.ctaText,
        shortUrl: props.shortUrl,
        disclosureTag: props.disclosureTag,
        productImageUrls: props.productImageUrls,
        aspectRatio: '9:16',
        audioBytes,
      });
      if (fingerprintRef.current !== reqFingerprint || renderSeqRef.current !== reqSeq) return;
      if (narratedVideoUrl) URL.revokeObjectURL(narratedVideoUrl);
      setNarratedVideoUrl(URL.createObjectURL(blob));
    } catch (err) {
      if (fingerprintRef.current === reqFingerprint && renderSeqRef.current === reqSeq) {
        setNarratedError(
          err instanceof Error
            ? err.message
            : 'Không thể ghép giọng đọc vào MP4. Không tự động hạ cấp sang video không tiếng.',
        );
      }
    } finally {
      if (fingerprintRef.current === reqFingerprint && renderSeqRef.current === reqSeq) {
        setNarratedLoading(false);
      }
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
          <select
            aria-label="Voice target mode"
            data-testid="pilot-voice-target-mode"
            value={voiceTargetMode}
            disabled={props.busy || voiceLoading}
            onChange={(e) => setVoiceTargetMode(e.target.value as 'narrated_mp4' | 'mp3_only')}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground"
          >
            <option value="narrated_mp4">MP4 có giọng đọc (kiểm tra AAC trước)</option>
            <option value="mp3_only">Chỉ xuất file .mp3</option>
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
            <>
              <a
                href={audioUrl}
                download={`sophia-voice-${props.artifactId}.mp3`}
                className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:opacity-90"
              >
                {t('pilotDownloadVoiceBtn')}
              </a>
              <button
                type="button"
                data-testid="pilot-render-narrated-mp4-btn"
                disabled={props.busy || narratedLoading}
                onClick={() => void handleRenderNarratedMp4()}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {narratedLoading ? t('loading') : 'Xuất MP4 có giọng đọc'}
              </button>
            </>
          )}
        </div>
        {voiceError && <p role="alert" className="mt-1 text-xs text-destructive">{voiceError}</p>}
        {narratedError && <p role="alert" className="mt-1 text-xs text-destructive">{narratedError}</p>}
        {audioUrl && (
          <audio controls src={audioUrl} className="mt-2 h-9 w-full max-w-md" />
        )}
        {narratedVideoUrl && (
          <div className="mt-3 space-y-2">
            <video
              controls
              data-testid="pilot-narrated-video-player"
              src={narratedVideoUrl}
              className="max-h-72 w-auto rounded-lg border border-border bg-black"
            />
            <div>
              <a
                href={narratedVideoUrl}
                data-testid="pilot-download-narrated-mp4-btn"
                download={`sophia-narrated-${props.artifactId}.mp4`}
                className="inline-flex rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:opacity-90"
              >
                Tải MP4 có giọng đọc (.mp4)
              </a>
            </div>
          </div>
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

      {/* 4. 1 Long -> 3 Shorts (9:16 Repurposing at $0 extra AI cost) */}
      {repurposedClips.length === 3 && (
        <div className="border-t border-border pt-3" data-testid="pilot-repurpose-3-shorts">
          <div className="text-xs font-semibold text-foreground">{t('pilotRepurposeTitle')}</div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t('pilotRepurposeHint')}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {repurposedClips.map((clip) => (
              <div
                key={clip.clipIndex}
                className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-muted/30 p-2.5 text-xs"
              >
                <div>
                  <div className="font-semibold text-foreground">
                    Short #{clip.clipIndex}: {clip.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {clip.script.scenes.length} scene(s) • ~{clip.script.total_duration}s • 9:16
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-testid={`pilot-repurpose-mp4-${clip.clipIndex}`}
                    disabled={props.busy || renderingClipIdx !== null}
                    onClick={() => void handleExportRepurposedClip(clip)}
                    className="rounded bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {renderingClipIdx === clip.clipIndex
                      ? t('loading')
                      : t('pilotRepurposeMp4Btn')}
                  </button>
                  <button
                    type="button"
                    data-testid={`pilot-repurpose-srt-${clip.clipIndex}`}
                    onClick={() =>
                      triggerTextFileDownload(
                        `sophia-short-${clip.clipIndex}-${props.artifactId}.srt`,
                        buildSrtFromScript(clip.script, props.ctaText),
                        'application/x-subrip;charset=utf-8',
                      )
                    }
                    className="rounded border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    .srt
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
