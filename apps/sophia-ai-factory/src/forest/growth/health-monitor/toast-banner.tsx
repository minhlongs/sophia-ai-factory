/**
 * Toast Notification Banner
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/toast-banner
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import type { ToastState } from './types';

interface ToastBannerProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function ToastBanner({ toast, onDismiss }: ToastBannerProps) {
  if (!toast) return null;

  return (
    <div
      className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
        toast.type === 'success'
          ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
          : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
      }`}
    >
      <div className="flex items-center gap-2">
        {toast.type === 'success' ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
        )}
        <span>{toast.text}</span>
      </div>
      <button
        onClick={onDismiss}
        className="text-zinc-400 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
