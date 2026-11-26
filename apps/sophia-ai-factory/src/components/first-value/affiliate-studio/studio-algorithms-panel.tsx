'use client';

/**
 * Live Studio Algorithms & 4-Matrix Policy Preflight Panel.
 *
 * Surfaces the backend algorithms (Policy-as-Code 4-Matrix Compliance,
 * OpenRouter 1-Key TTS, OmniRouter MP4 Fallback, Smartlink /api/r/) in a
 * single calm, hairline-bordered strip inside the Script tab.
 *
 * @module components/first-value/affiliate-studio/studio-algorithms-panel
 */

import { useMemo, useState } from 'react';
import { Check, Copy, ShieldCheck } from 'lucide-react';
import {
  runPolicyPreflight,
  type ComplianceJurisdiction,
  type CompliancePlatform,
  type ComplianceProvider,
  type ComplianceVertical,
} from '@/seed/compliance/policy-preflight-engine';

export interface StudioAlgorithmsPanelProps {
  readonly scriptText: string;
  readonly vertical?: ComplianceVertical;
  readonly defaultJurisdiction?: ComplianceJurisdiction;
}

const JURISDICTIONS: readonly ComplianceJurisdiction[] = ['VN', 'US', 'UK', 'EU', 'SG', 'GLOBAL'];
const PLATFORMS: ReadonlyArray<{ readonly id: CompliancePlatform; readonly label: string }> = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube_shorts', label: 'YouTube Shorts' },
  { id: 'instagram_reels', label: 'IG Reels' },
  { id: 'facebook_reels', label: 'FB Reels' },
];
const PROVIDERS: ReadonlyArray<{ readonly id: ComplianceProvider; readonly label: string }> = [
  { id: 'heygen', label: 'HeyGen Avatar' },
  { id: 'browser_mp4', label: 'Browser MP4 ($0)' },
  { id: 'openrouter_tts', label: 'OpenRouter TTS' },
];

export function StudioAlgorithmsPanel({
  scriptText,
  vertical = 'crypto',
  defaultJurisdiction = 'VN',
}: StudioAlgorithmsPanelProps) {
  const [jurisdiction, setJurisdiction] = useState<ComplianceJurisdiction>(defaultJurisdiction);
  const [platform, setPlatform] = useState<CompliancePlatform>('tiktok');
  const [provider, setProvider] = useState<ComplianceProvider>('heygen');
  const [copiedDisclosure, setCopiedDisclosure] = useState(false);

  const preflight = useMemo(
    () =>
      runPolicyPreflight({
        text: scriptText,
        jurisdiction,
        platform,
        provider,
        vertical,
        maxChars: 5000,
      }),
    [scriptText, jurisdiction, platform, provider, vertical],
  );

  async function handleCopyDisclosure() {
    try {
      await navigator.clipboard.writeText(preflight.requiredDisclosure);
      setCopiedDisclosure(true);
      setTimeout(() => setCopiedDisclosure(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <section
      data-testid="studio-algorithms-panel"
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Sophia Engine • Policy-as-Code Preflight (4 Ma Trận)
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">
            Policy Guard ✓
          </span>
          <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
            OpenRouter TTS ✓
          </span>
          <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
            OmniRouter MP4 ✓
          </span>
          <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
            Smartlink /api/r/ ✓
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
        <label className="flex flex-col gap-1 text-muted-foreground">
          <span className="text-[11px] font-medium">Khu vực / Luật (Jurisdiction)</span>
          <select
            aria-label="Jurisdiction"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value as ComplianceJurisdiction)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
          >
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-muted-foreground">
          <span className="text-[11px] font-medium">Nền tảng (Platform)</span>
          <select
            aria-label="Platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as CompliancePlatform)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-muted-foreground">
          <span className="text-[11px] font-medium">Video Provider</span>
          <select
            aria-label="Video Provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ComplianceProvider)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium text-foreground">
            {preflight.replacedCount === 0
              ? 'An toàn kiểm duyệt — 0 cụm từ rủi ro.'
              : `Đã tự động làm mềm ${preflight.replacedCount} cụm từ rủi ro trước khi render (${preflight.appliedRules.join(', ')}).`}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {preflight.requiredDisclosure}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleCopyDisclosure()}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
        >
          {copiedDisclosure ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          <span>{copiedDisclosure ? 'Đã copy' : 'Copy Disclosure'}</span>
        </button>
      </div>

      {preflight.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          {preflight.warnings.join(' • ')}
        </div>
      )}
    </section>
  );
}
