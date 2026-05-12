'use client';

/**
 * local-mode-step-ui.tsx
 * Sub-components for LocalModeStep: CopyBox and StatusBadge.
 * Kept separate to stay under 200-LOC limit per file.
 */

import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Clock, XCircle, Copy, Check, Loader2 } from 'lucide-react';

// ── Types (shared) ────────────────────────────────────────────────────────────

export type LocalModeStatus =
  | 'idle'
  | 'ineligible'
  | 'not-provisioned'
  | 'polling'
  | 'provisioned-healthy'
  | 'provisioned-stale'
  | 'provisioned-failed';

// ── CopyBox ───────────────────────────────────────────────────────────────────

interface CopyBoxProps { text: string }

export function CopyBox({ text }: CopyBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* clipboard permission denied — silently fail */ });
  };

  return (
    <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-3 border border-border">
      <code className="flex-1 text-xs font-mono break-all text-foreground">{text}</code>
      <button
        onClick={handleCopy}
        aria-label="Sao chép lệnh cài đặt / Copy install command"
        className="shrink-0 p-1.5 rounded hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-green-600" aria-hidden="true" /> : <Copy className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
      </button>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

interface StatusBadgeProps { status: LocalModeStatus }

export function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<LocalModeStatus, { icon: React.ReactNode; label: string; className: string }> = {
    idle: {
      icon: <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />,
      label: 'Đang kiểm tra…',
      className: 'bg-muted text-muted-foreground',
    },
    ineligible: {
      icon: <XCircle className="w-4 h-4" aria-hidden="true" />,
      label: 'Không tương thích / Ineligible',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    },
    'not-provisioned': {
      icon: <AlertCircle className="w-4 h-4" aria-hidden="true" />,
      label: 'Chưa cài đặt / Not installed',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    },
    polling: {
      icon: <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />,
      label: 'Đang chờ cài đặt… / Waiting for installer…',
      className: 'bg-muted text-muted-foreground',
    },
    'provisioned-healthy': {
      icon: <CheckCircle className="w-4 h-4" aria-hidden="true" />,
      label: 'Đang hoạt động / Healthy',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    },
    'provisioned-stale': {
      icon: <Clock className="w-4 h-4" aria-hidden="true" />,
      label: 'Chậm phản hồi / Stale',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    },
    'provisioned-failed': {
      icon: <XCircle className="w-4 h-4" aria-hidden="true" />,
      label: 'Lỗi kết nối / Failed',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    },
  };

  const { icon, label, className } = map[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${className}`}
    >
      {icon} {label}
    </span>
  );
}
