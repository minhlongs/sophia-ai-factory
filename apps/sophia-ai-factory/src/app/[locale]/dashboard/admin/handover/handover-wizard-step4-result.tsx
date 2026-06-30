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
          <h2 className="text-lg font-semibold text-muted-foreground-100">{isVi ? 'Bàn giao thành công!' : 'Handover Complete!'}</h2>
          <p className="text-sm text-muted-foreground-400">{isVi ? 'Tài khoản đã tạo và email đã gửi.' : 'Account created and welcome email sent.'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border-700 bg-muted-900/50 p-4 space-y-2">
        <div className="text-xs text-muted-foreground-500 uppercase tracking-wide mb-3">Magic Link (24h)</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-primary-300 bg-muted-950 rounded-lg px-3 py-2 overflow-hidden overflow-ellipsis whitespace-nowrap">
            {result.magicLinkUrl}
          </code>
          <button onClick={onCopy} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition-colors">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? (isVi ? 'Đã sao chép' : 'Copied') : (isVi ? 'Sao chép' : 'Copy')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-muted-900/50 border border-border-700 p-3 text-center">
          <div className="text-lg font-bold text-primary-400">{result.installedSops.length}</div>
          <div className="text-muted-foreground-500 text-xs mt-0.5">{isVi ? 'SOPs đã cài' : 'SOPs Installed'}</div>
        </div>
        <div className="rounded-lg bg-muted-900/50 border border-border-700 p-3 text-center">
          <div className="text-lg font-bold text-emerald-400">{result.emailSent ? '✓' : '✗'}</div>
          <div className="text-muted-foreground-500 text-xs mt-0.5">{isVi ? 'Email gửi' : 'Email Sent'}</div>
        </div>
        <div className="rounded-lg bg-muted-900/50 border border-border-700 p-3 text-center">
          <div className="text-lg font-bold text-blue-400 text-xs font-mono truncate">{result.handoverId.slice(0, 8)}</div>
          <div className="text-muted-foreground-500 text-xs mt-0.5">Handover ID</div>
        </div>
      </div>

      <button onClick={onDownload} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border-600 bg-muted-800/50 hover:bg-muted-700/50 text-muted-foreground-200 text-sm font-medium transition-colors">
        <Download size={16} />
        {isVi ? 'Tải Handover Document' : 'Download Handover Document'}
      </button>

      <div className="pt-4 border-t border-border-800">
        <button onClick={onReset} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-700 text-muted-foreground-300 text-sm hover:bg-muted-800 transition-colors">
          <RefreshCw size={16} />
          {isVi ? 'Bàn giao khách hàng mới' : 'New Customer Handover'}
        </button>
      </div>
    </div>
  );
}
