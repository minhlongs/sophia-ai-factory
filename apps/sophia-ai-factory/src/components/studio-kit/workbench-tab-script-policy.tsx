'use client';

/**
 * Tab 1 — Script, Policy Preflight 4-Axis, 3s Hook Beat & Omnichannel Atomizer.
 * Calls pure Round 1–19 `seed/*` engines directly in-browser (0ms, $0 COGS).
 */

import { useMemo, useState } from 'react';
import {
  runPolicyPreflight,
  type ComplianceJurisdiction,
  type CompliancePlatform,
} from '@/seed/compliance/policy-preflight-engine';
import { evaluateHookAndBeatPacing } from '@/seed/ai/hook-beat-evaluator';
import { atomizeScriptForOmnichannel } from '@/seed/ai/content-atomizer';

const DEFAULT_SCRIPT =
  'Stop losing 40% on crypto exchange fees. Here is how top traders cut fees legally in 30 seconds. Step 1: compare maker rebates. Step 2: verify your tier. Not financial advice — link in first comment.';

export function WorkbenchTabScriptPolicy({ locale }: { readonly locale: 'vi' | 'en' }) {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [platform, setPlatform] = useState<CompliancePlatform>('tiktok');
  const [jurisdiction, setJurisdiction] = useState<ComplianceJurisdiction>('VN');

  const result = useMemo(() => {
    const policy = runPolicyPreflight({
      text: script,
      platform,
      jurisdiction,
      vertical: 'crypto',
      provider: 'browser_mp4',
    });
    const hook = evaluateHookAndBeatPacing(script);
    const sentences = script.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const atomized = atomizeScriptForOmnichannel({
      script: {
        title: sentences[0] ?? script.slice(0, 60),
        total_duration: Math.max(15, sentences.length * 5),
        scenes: sentences.map((narration, index) => ({
          scene_number: index + 1,
          duration_estimate: 5,
          visual_description: narration,
          narration,
        })),
      },
      ctaText: locale === 'vi' ? 'Xem link ở bình luận đầu tiên' : 'Link in first comment',
      shortUrl: 'https://sophia.agencyos.network/r/demo',
      disclosureTag: locale === 'vi' ? '#ad #affiliate' : '#ad #affiliate',
    });
    return { policy, hook, atomized };
  }, [script, platform, jurisdiction, locale]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {locale === 'vi' ? 'Nền tảng phát hành' : 'Target Platform'}
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as CompliancePlatform)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="tiktok">TikTok</option>
            <option value="youtube_shorts">YouTube Shorts</option>
            <option value="instagram_reels">Instagram Reels</option>
            <option value="facebook_reels">Facebook Reels</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {locale === 'vi' ? 'Thị trường pháp lý' : 'Legal Market'}
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value as ComplianceJurisdiction)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        placeholder={locale === 'vi' ? 'Dán kịch bản video vào đây...' : 'Paste your video script here...'}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">
            {locale === 'vi' ? 'Kiểm duyệt Luật 4-Axis' : '4-Axis Policy Preflight'}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
            {result.policy.warnings.length === 0 ? 'PASS' : `${result.policy.warnings.length} WARNINGS`}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {locale === 'vi'
              ? `Tự chuẩn hóa ${result.policy.replacedCount} cụm từ • ${result.policy.appliedRules.length} luật áp dụng`
              : `Sanitized ${result.policy.replacedCount} phrases • ${result.policy.appliedRules.length} rules applied`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">
            {locale === 'vi' ? 'Điểm 3 Giây Mở Đầu (Hook)' : '3-Second Hook Score'}
          </div>
          <div className="mt-1 text-lg font-semibold text-indigo-600 dark:text-indigo-400">
            {result.hook.weightedScore100}/100 ({result.hook.estimatedHookSec.toFixed(1)}s)
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {locale === 'vi' ? 'Trigger:' : 'Trigger:'} <span className="font-mono">{result.hook.detectedTrigger}</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">
            {locale === 'vi' ? 'Tách Đa Kênh (Atomizer)' : 'Omnichannel Atomizer'}
          </div>
          <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {result.atomized.xThread.length} X posts + TG + Reddit
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
            {result.atomized.telegramPost}
          </p>
        </div>
      </div>
    </div>
  );
}
