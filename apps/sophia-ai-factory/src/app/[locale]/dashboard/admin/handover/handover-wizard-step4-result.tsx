'use client';

/**
 * Handover Wizard Step 4 — Result display after successful creation.
 * Shows magic link, stats, download button, reset action.
 *
 * @module app/[locale]/dashboard/admin/handover/handover-wizard-step4-result
 */

import { Check, Copy, Download, RefreshCw } from 'lucide-react';
import type { HandoverResult, FormState } from './handover-wizard-steps';

interface Props {
  result: HandoverResult;
  form: FormState;
  isVi: boolean;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onReset: () => void;
}

export function Step4Result({ result, form, isVi, copied, onCopy, onDownload, onReset }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <Check size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{isVi ? 'Bàn giao thành công!' : 'Handover Complete!'}</h2>
          <p className="text-sm text-zinc-400">{isVi ? 'Tài khoản đã tạo và email đã gửi.' : 'Account created and welcome email sent.'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 space-y-2">
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Magic Link (24h)</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-violet-300 bg-zinc-950 rounded-lg px-3 py-2 overflow-hidden overflow-ellipsis whitespace-nowrap">
            {result.magicLinkUrl}
          </code>
          <button onClick={onCopy} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? (isVi ? 'Đã sao chép' : 'Copied') : (isVi ? 'Sao chép' : 'Copy')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-zinc-900/50 border border-zinc-700 p-3 text-center">
          <div className="text-lg font-bold text-violet-400">{result.installedSops.length}</div>
          <div className="text-zinc-500 text-xs mt-0.5">{isVi ? 'SOPs đã cài' : 'SOPs Installed'}</div>
        </div>
        <div className="rounded-lg bg-zinc-900/50 border border-zinc-700 p-3 text-center">
          <div className="text-lg font-bold text-emerald-400">{result.emailSent ? '✓' : '✗'}</div>
          <div className="text-zinc-500 text-xs mt-0.5">{isVi ? 'Email gửi' : 'Email Sent'}</div>
        </div>
        <div className="rounded-lg bg-zinc-900/50 border border-zinc-700 p-3 text-center">
          <div className="text-lg font-bold text-blue-400 text-xs font-mono truncate">{result.handoverId.slice(0, 8)}</div>
          <div className="text-zinc-500 text-xs mt-0.5">Handover ID</div>
        </div>
      </div>

      <button onClick={onDownload} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-zinc-600 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-200 text-sm font-medium transition-colors">
        <Download size={16} />
        {isVi ? 'Tải Handover Document' : 'Download Handover Document'}
      </button>

      <div className="pt-4 border-t border-zinc-800">
        <button onClick={onReset} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors">
          <RefreshCw size={16} />
          {isVi ? 'Bàn giao khách hàng mới' : 'New Customer Handover'}
        </button>
      </div>
    </div>
  );
}
