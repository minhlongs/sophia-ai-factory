'use client';

/**
 * Tab 1 — Script, Policy Preflight 4-Axis, 3s Hook Beat & Omnichannel Atomizer.
 * Calls pure Round 1–19 `seed/*` engines directly in-browser (0ms, $0 COGS).
 */

import { useDeferredValue, useMemo, useState } from 'react';
import {
  runPolicyPreflight,
  type ComplianceJurisdiction,
  type CompliancePlatform,
} from '@/seed/compliance/policy-preflight-engine';
import { evaluateHookAndBeatPacing } from '@/seed/ai/hook-beat-evaluator';
import { atomizeScriptForOmnichannel } from '@/seed/ai/content-atomizer';

export const DEFAULT_WORKBENCH_SCRIPT =
  'Stop losing 40% on crypto exchange fees. Here is how top traders cut fees legally in 30 seconds. Step 1: compare maker rebates. Step 2: verify your tier. Not financial advice — link in first comment.';

export interface WorkbenchTabScriptPolicyProps {
  readonly locale: 'vi' | 'en';
  readonly script?: string;
  readonly onScriptChange?: (value: string) => void;
  readonly platform?: CompliancePlatform;
  readonly onPlatformChange?: (value: CompliancePlatform) => void;
  readonly jurisdiction?: ComplianceJurisdiction;
  readonly onJurisdictionChange?: (value: ComplianceJurisdiction) => void;
}

export function WorkbenchTabScriptPolicy({
  locale,
  script: controlledScript,
  onScriptChange,
  platform: controlledPlatform,
  onPlatformChange,
  jurisdiction: controlledJurisdiction,
  onJurisdictionChange,
}: WorkbenchTabScriptPolicyProps) {
  const [localScript, setLocalScript] = useState(DEFAULT_WORKBENCH_SCRIPT);
  const [localPlatform, setLocalPlatform] = useState<CompliancePlatform>('tiktok');
  const [localJurisdiction, setLocalJurisdiction] = useState<ComplianceJurisdiction>('VN');

  const script = controlledScript ?? localScript;
  const setScript = onScriptChange ?? setLocalScript;
  const platform = controlledPlatform ?? localPlatform;
  const setPlatform = onPlatformChange ?? setLocalPlatform;
  const jurisdiction = controlledJurisdiction ?? localJurisdiction;
  const setJurisdiction = onJurisdictionChange ?? setLocalJurisdiction;
  const deferredScript = useDeferredValue(script);

  const result = useMemo(() => {
    const policy = runPolicyPreflight({
      text: deferredScript,
      platform,
      jurisdiction,
      vertical: 'crypto',
      provider: 'browser_mp4',
    });
    const hook = evaluateHookAndBeatPacing(deferredScript);
    const sentences = deferredScript.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const atomized = atomizeScriptForOmnichannel({
      script: {
        title: sentences[0] ?? deferredScript.slice(0, 60),
        total_duration: Math.max(15, sentences.length * 5),
        scenes: sentences.map((narration, index) => ({
          scene_number: index + 1,
          duration_estimate: 5,
          visual_description: narration,
          narration,
        })),
      },
      ctaText: locale === 'vi' ? 'Xem link ở bình luận đầu tiên' : 'Link in first comment',
      shortUrl: 'https://sophia-ai-factory.agencyos-openclaw.workers.dev/r/demo',
      disclosureTag: '#ad #affiliate',
    });
    return { policy, hook, atomized };
  }, [deferredScript, platform, jurisdiction, locale]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {locale === 'vi' ? 'Nền tảng phát hành' : 'Target Platform'}
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as CompliancePlatform)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="tiktok">TikTok</option>
            <option value="youtube_shorts">YouTube Shorts</option>
            <option value="instagram_reels">Instagram Reels</option>
            <option value="facebook_reels">Facebook Reels</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {locale === 'vi' ? 'Thị trường pháp lý' : 'Legal Market'}
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value as ComplianceJurisdiction)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="VN">Vietnam (VN)</option>
            <option value="US">United States (FTC)</option>
            <option value="EU">Europe (MiCA)</option>
            <option value="UK">United Kingdom (FCA)</option>
            <option value="GLOBAL">Global</option>
          </select>
        </label>
      </div>

      <textarea
        rows={4}
        value={script}
        onChange={(e) => setScript(e.target.value)}
        aria-label={locale === 'vi' ? 'Kịch bản video cần kiểm tra' : 'Video script to check'}
        className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={locale === 'vi' ? 'Dán kịch bản video vào đây...' : 'Paste your video script here...'}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">
            {locale === 'vi' ? 'Kiểm duyệt Luật 4-Axis' : '4-Axis Policy Preflight'}
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {result.policy.warnings.length === 0 ? 'PASS' : `${result.policy.warnings.length} WARNINGS`}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {locale === 'vi'
              ? `Tự chuẩn hóa ${result.policy.replacedCount} cụm từ • ${result.policy.appliedRules.length} luật áp dụng`
              : `Sanitized ${result.policy.replacedCount} phrases • ${result.policy.appliedRules.length} rules applied`}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">
            {locale === 'vi' ? 'Điểm 3 Giây Mở Đầu (Hook)' : '3-Second Hook Score'}
          </div>
          <div className="md3-tabular-nums mt-1 text-lg font-semibold text-primary-text">
            {result.hook.weightedScore100}/100 ({result.hook.estimatedHookSec.toFixed(1)}s)
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {locale === 'vi' ? 'Trigger:' : 'Trigger:'} <span className="font-mono">{result.hook.detectedTrigger}</span>
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">
            {locale === 'vi' ? 'Tách Đa Kênh (Atomizer)' : 'Omnichannel Atomizer'}
          </div>
          <div className="md3-tabular-nums mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
            {result.atomized.xThread.length} X posts + TG + Reddit
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {result.atomized.telegramPost}
          </p>
        </div>
      </div>
    </div>
  );
}
