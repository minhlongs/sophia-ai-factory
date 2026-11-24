'use client';

/**
 * Script review, per-scene title/content draft editing, explicit Accept/Reject controls,
 * and Private Export panel (Markdown, JSON, Copy, Download).
 *
 * @module components/first-value/first-value-review-panel
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';

export interface FirstValueReviewPanelProps {
  readonly review: DurableFirstValueReview | null;
  readonly busy: boolean;
  readonly exportPayload: string | null;
  readonly onAccept: () => Promise<void>;
  readonly onReject: (reason: string) => Promise<void>;
  readonly onExport: (format: 'json' | 'markdown') => Promise<void>;
  readonly onEdit?: (script: ScriptOutput) => Promise<boolean>;
}

export function FirstValueReviewPanel({
  review,
  busy,
  exportPayload,
  onAccept,
  onReject,
  onExport,
  onEdit,
}: FirstValueReviewPanelProps) {
  const t = useTranslations('firstValue');
  const [rejectReason, setRejectReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftScript, setDraftScript] = useState<ScriptOutput | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastExportFormat, setLastExportFormat] = useState<'json' | 'markdown'>('markdown');

  const reviewArtifactId = review?.artifactId ?? null;
  useEffect(() => {
    setEditing(false);
    setDraftScript(null);
    setDraftSaved(false);
    setCopied(false);
  }, [reviewArtifactId]);

  if (!review) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <h2 className="mb-2 text-base font-semibold text-foreground">{t('reviewTitle')}</h2>
        <p>{t('reviewEmpty')}</p>
      </section>
    );
  }

  const isFinalized = review.reviewState !== 'pending_review';
  const isAccepted = review.reviewState === 'accepted';

  function startEditing() {
    if (!review) return;
    setDraftSaved(false);
    setDraftScript({
      title: review.script.title,
      total_duration: review.script.total_duration,
      scenes: review.script.scenes.map((scene) => ({ ...scene })),
    });
    setEditing(true);
  }

  async function saveEdits() {
    if (!draftScript || !onEdit) return;
    const normalized: ScriptOutput = {
      title: draftScript.title,
      total_duration: draftScript.total_duration,
      scenes: draftScript.scenes.map((scene) => {
        const trimmedSceneTitle = scene.title?.trim();
        const { title: _omittedTitle, ...rest } = scene;
        return trimmedSceneTitle ? { ...rest, title: trimmedSceneTitle } : rest;
      }),
    };
    const ok = await onEdit(normalized);
    if (ok) {
      setEditing(false);
      setDraftScript(null);
      setDraftSaved(true);
    }
  }

  async function triggerExport(format: 'json' | 'markdown') {
    setLastExportFormat(format);
    await onExport(format);
  }

  async function copyExport() {
    if (!exportPayload || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(exportPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable in restricted browser contexts
    }
  }

  function downloadExport() {
    if (!exportPayload || !review || typeof document === 'undefined') return;
    const ext = lastExportFormat === 'json' ? 'json' : 'md';
    const mime = lastExportFormat === 'json' ? 'application/json' : 'text/markdown';
    const blob = new Blob([exportPayload], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sophia-script-${review.artifactId}.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{t('reviewTitle')}</h2>
          <div className="flex items-center gap-2">
            {!isFinalized && onEdit && !editing && (
              <button
                type="button"
                disabled={busy}
                onClick={startEditing}
                className="rounded-lg border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('editScriptBtn')}
              </button>
            )}
            <span className="rounded-full bg-amber-500/15 px-3 py-1 font-mono text-xs font-medium text-amber-600 dark:text-amber-400">
              {review.provenanceLabel}
            </span>
          </div>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{t('stateLabel')}</dt>
            <dd className="font-mono font-semibold text-foreground">{review.reviewState}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('versionLabel')}</dt>
            <dd className="font-mono font-semibold text-foreground">v{review.version}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('mcuChargedLabel')}</dt>
            <dd className="font-mono font-semibold text-foreground">{review.mcuCharged}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('artifactRefLabel')}</dt>
            <dd className="truncate font-mono text-foreground" title={review.privateArtifactRef}>
              {review.privateArtifactRef}
            </dd>
          </div>
        </dl>

        {draftSaved && !editing && (
          <p className="mb-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {t('draftSavedNotice')}
          </p>
        )}

        {editing && draftScript ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('scriptTitleLabel')}
              <input
                type="text"
                value={draftScript.title}
                disabled={busy}
                onChange={(e) => setDraftScript({ ...draftScript, title: e.target.value })}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            {draftScript.scenes.map((scene, idx) => (
              <div
                key={scene.scene_number}
                className="flex flex-col gap-2 rounded-lg border border-border/80 bg-background p-3"
              >
                <div className="font-mono text-xs font-medium text-primary">
                  {t('sceneHeading')} {scene.scene_number} ({scene.duration_estimate}s)
                </div>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {t('sceneTitleLabel')}
                  <input
                    type="text"
                    maxLength={200}
                    value={scene.title ?? ''}
                    placeholder={`${t('sceneHeading')} ${scene.scene_number}`}
                    disabled={busy}
                    onChange={(e) => {
                      const nextScenes = draftScript.scenes.map((item, i) =>
                        i === idx ? { ...item, title: e.target.value } : item,
                      );
                      setDraftScript({ ...draftScript, scenes: nextScenes });
                    }}
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {t('visualLabel')}
                  <textarea
                    rows={2}
                    value={scene.visual_description}
                    disabled={busy}
                    onChange={(e) => {
                      const nextScenes = draftScript.scenes.map((item, i) =>
                        i === idx ? { ...item, visual_description: e.target.value } : item,
                      );
                      setDraftScript({ ...draftScript, scenes: nextScenes });
                    }}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {t('narrationLabel')}
                  <textarea
                    rows={2}
                    value={scene.narration}
                    disabled={busy}
                    onChange={(e) => {
                      const nextScenes = draftScript.scenes.map((item, i) =>
                        i === idx ? { ...item, narration: e.target.value } : item,
                      );
                      setDraftScript({ ...draftScript, scenes: nextScenes });
                    }}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveEdits()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? t('loading') : t('saveEditsBtn')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setDraftScript(null);
                }}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('cancelEditBtn')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{review.script.title}</h3>
            <div className="flex flex-col gap-3">
              {review.script.scenes.map((scene) => (
                <article
                  key={scene.scene_number}
                  className="rounded-lg border border-border/80 bg-background p-3 text-sm"
                >
                  <div className="mb-1 font-mono text-xs font-medium text-primary">
                    {t('sceneHeading')} {scene.scene_number}
                    {scene.title ? `: ${scene.title}` : ''} ({scene.duration_estimate}s)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{t('visualLabel')}:</strong>{' '}
                    {scene.visual_description}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    <strong>{t('narrationLabel')}:</strong> {scene.narration}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
          {isFinalized ? (
            <p className="text-xs font-medium text-muted-foreground">{t('finalizedNotice')}</p>
          ) : (
            <>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('rejectReasonPlaceholder')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                disabled={busy || editing}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy || editing}
                  onClick={() => void onAccept()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {t('acceptBtn')}
                </button>
                <button
                  type="button"
                  disabled={busy || editing}
                  onClick={() => void onReject(rejectReason)}
                  className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                >
                  {t('rejectBtn')}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-2 text-base font-semibold text-foreground">{t('exportTitle')}</h2>
        {!isAccepted ? (
          <p className="text-sm text-muted-foreground">{t('exportLocked')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void triggerExport('json')}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {t('exportJsonBtn')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void triggerExport('markdown')}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('exportMarkdownBtn')}
              </button>
              {exportPayload && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void copyExport()}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {copied ? t('copiedBtn') : t('copyExportBtn')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={downloadExport}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {t('downloadExportBtn')}
                  </button>
                </>
              )}
            </div>
            {exportPayload && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t('exportSuccess')}
                </p>
                <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
                  {exportPayload}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
