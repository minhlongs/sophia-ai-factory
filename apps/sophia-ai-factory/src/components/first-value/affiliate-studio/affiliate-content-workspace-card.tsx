'use client';

/**
 * Step 5 — Content Factory Workspace (`#content-factory`).
 *
 * Displays & allows editing of the full Affiliate Campaign Pack:
 * - Audience analysis, Value proposition, Content angles
 * - Hook, Call to action, Short-form scenes
 * - Social post, Affiliate disclosure, and locked Verified Referral URL
 * Supports Save Campaign Draft, Approve Content, and Manual Publish Bundle Export (Markdown / JSON / Copy / Download).
 *
 * @module components/first-value/affiliate-studio/affiliate-content-workspace-card
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AffiliateCampaignPack } from '@/seed/ai/affiliate-campaign-prompt';
import type { PilotAffiliateCampaignRecord } from '@/tree/first-value/pilot-affiliate-studio-repo';

export interface AffiliateContentWorkspaceCardProps {
  readonly campaign: PilotAffiliateCampaignRecord | null;
  readonly exportPayload: string | null;
  readonly busy: boolean;
  readonly onSaveEdit: (pack: AffiliateCampaignPack) => Promise<boolean>;
  readonly onApprove: () => Promise<boolean>;
  readonly onExport: (format: 'markdown' | 'json') => Promise<void>;
}

export function AffiliateContentWorkspaceCard({
  campaign,
  exportPayload,
  busy,
  onSaveEdit,
  onApprove,
  onExport,
}: AffiliateContentWorkspaceCardProps) {
  const t = useTranslations('firstValue');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AffiliateCampaignPack | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportFmt, setExportFmt] = useState<'markdown' | 'json'>('markdown');

  const campaignId = campaign?.id ?? null;
  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setSavedNotice(false);
    setCopied(false);
  }, [campaignId]);

  if (!campaign) {
    return (
      <section id="content-factory" className="rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground">
        <h2 className="mb-1 text-base font-semibold text-foreground">{t('affWorkspaceTitle')}</h2>
        <p>{t('affWorkspaceEmpty')}</p>
      </section>
    );
  }

  const isApproved = campaign.reviewState === 'approved';
  const pack = campaign.pack;

  function beginEdit() {
    setSavedNotice(false);
    setDraft({
      ...pack,
      contentAngles: [...pack.contentAngles],
      shortFormScript: {
        ...pack.shortFormScript,
        scenes: pack.shortFormScript.scenes.map((s) => ({ ...s })),
      },
    });
    setEditing(true);
  }

  async function saveDraft() {
    if (!draft) return;
    const ok = await onSaveEdit(draft);
    if (ok) {
      setEditing(false);
      setDraft(null);
      setSavedNotice(true);
    }
  }

  async function triggerExport(fmt: 'markdown' | 'json') {
    setExportFmt(fmt);
    await onExport(fmt);
  }

  async function copyBundle() {
    if (!exportPayload || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(exportPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked
    }
  }

  function downloadBundle() {
    if (!exportPayload || !campaign || typeof document === 'undefined') return;
    const ext = exportFmt === 'json' ? 'json' : 'md';
    const mime = exportFmt === 'json' ? 'application/json' : 'text/markdown';
    const blob = new Blob([exportPayload], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sophia-affiliate-campaign-${campaign.id}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section id="content-factory" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('affWorkspaceTitle')}</h2>
          <p className="font-mono text-xs text-muted-foreground">
            v{campaign.version} · {campaign.reviewState} · {campaign.provenanceLabel}
          </p>
        </div>
        {!isApproved && !editing && (
          <button
            type="button"
            disabled={busy}
            onClick={beginEdit}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {t('editScriptBtn')}
          </button>
        )}
      </div>

      {savedNotice && !editing && (
        <p className="mb-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {t('draftSavedNotice')}
        </p>
      )}

      {editing && draft ? (
        <div className="flex flex-col gap-3 text-xs">
          <label className="flex flex-col gap-1 text-muted-foreground">
            {t('affCampaignTitleLabel')}
            <input
              type="text"
              value={draft.campaignTitle}
              onChange={(e) => setDraft({ ...draft, campaignTitle: e.target.value })}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-muted-foreground">
            {t('affHookLabel')}
            <input
              type="text"
              value={draft.hook}
              onChange={(e) => setDraft({ ...draft, hook: e.target.value })}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-muted-foreground">
            {t('affCtaLabel')}
            <input
              type="text"
              value={draft.callToAction}
              onChange={(e) => setDraft({ ...draft, callToAction: e.target.value })}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-muted-foreground">
            {t('affSocialPostLabel')}
            <textarea
              rows={4}
              value={draft.socialPost}
              onChange={(e) => setDraft({ ...draft, socialPost: e.target.value })}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          {draft.shortFormScript.scenes.map((scene, idx) => (
            <div key={scene.scene_number} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-1 font-mono font-semibold text-primary">
                {t('sceneHeading')} {scene.scene_number} ({scene.duration_estimate}s)
              </div>
              <textarea
                rows={2}
                value={scene.narration}
                onChange={(e) => {
                  const nextScenes = draft.shortFormScript.scenes.map((s, i) =>
                    i === idx ? { ...s, narration: e.target.value } : s,
                  );
                  setDraft({
                    ...draft,
                    shortFormScript: { ...draft.shortFormScript, scenes: nextScenes },
                  });
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveDraft()}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              {busy ? t('loading') : t('saveEditsBtn')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setDraft(null);
              }}
              className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground"
            >
              {t('cancelEditBtn')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-xs">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-sm font-semibold text-foreground">{pack.campaignTitle}</div>
            <div className="mt-1 font-mono text-primary">{pack.referralUrl}</div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <strong className="text-foreground">{t('affAudienceAnalysisLabel')}:</strong>
              <p className="mt-1 text-muted-foreground">{pack.audienceAnalysis}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <strong className="text-foreground">{t('affValuePropLabel')}:</strong>
              <p className="mt-1 text-muted-foreground">{pack.valueProposition}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <strong className="text-foreground">{t('affAnglesLabel')}:</strong>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {pack.contentAngles.map((angle, i) => (
                <li key={i}>{angle}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <div>
              <strong className="text-foreground">{t('affHookLabel')}:</strong> {pack.hook}
            </div>
            <div className="mt-1">
              <strong className="text-foreground">{t('affCtaLabel')}:</strong> {pack.callToAction}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {pack.shortFormScript.scenes.map((scene) => (
              <div key={scene.scene_number} className="rounded-lg border border-border bg-background p-3">
                <div className="font-mono font-semibold text-primary">
                  {t('sceneHeading')} {scene.scene_number}
                  {scene.title ? `: ${scene.title}` : ''} ({scene.duration_estimate}s)
                </div>
                <p className="mt-1 text-muted-foreground">
                  <strong className="text-foreground">{t('visualLabel')}:</strong>{' '}
                  {scene.visual_description}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  <strong>{t('narrationLabel')}:</strong> {scene.narration}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <strong className="text-foreground">{t('affSocialPostLabel')}:</strong>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-foreground">{pack.socialPost}</pre>
          </div>

          <div className="rounded-lg border border-amber-500/40 bg-muted/40 p-3">
            <strong className="text-foreground">{t('affDisclosureLabel')}:</strong>
            <p className="mt-1 text-muted-foreground">{pack.affiliateDisclosure}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {!isApproved ? (
          <button
            type="button"
            disabled={busy || editing}
            onClick={() => void onApprove()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {t('affApproveCampaignBtn')}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void triggerExport('markdown')}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {t('exportMarkdownBtn')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void triggerExport('json')}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
            >
              {t('exportJsonBtn')}
            </button>
            {exportPayload && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void copyBundle()}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
                >
                  {copied ? t('copiedBtn') : t('copyExportBtn')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={downloadBundle}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
                >
                  {t('downloadExportBtn')}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {exportPayload && (
        <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
          {exportPayload}
        </pre>
      )}
    </section>
  );
}
