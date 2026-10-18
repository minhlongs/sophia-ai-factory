'use client';

import React from 'react';
import { Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PRIORITY_LABELS, type TicketPriority } from './support-ticket-list';

export interface SupportTicketCreateFormProps {
  locale: 'vi' | 'en';
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  priority: TicketPriority;
  setPriority: (val: TicketPriority) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function SupportTicketCreateForm({
  locale,
  title,
  setTitle,
  description,
  setDescription,
  priority,
  setPriority,
  isSubmitting,
  errorMessage,
  successMessage,
  onSubmit,
  onCancel,
}: SupportTicketCreateFormProps) {
  const isVi = locale === 'vi';

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-error/10 p-3 text-xs text-error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant">
          {isVi ? 'Tiêu đề vấn đề' : 'Issue Subject'}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isVi ? 'VD: Lỗi kết nối fal.ai...' : 'E.g., fal.ai connection timeout...'}
          className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-variant/20 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-hidden"
          maxLength={200}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant">
          {isVi ? 'Mức độ ưu tiên' : 'Priority Level'}
        </label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
          className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-variant/20 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-hidden"
        >
          <option value="low">{PRIORITY_LABELS.low[locale]}</option>
          <option value="normal">{PRIORITY_LABELS.normal[locale]}</option>
          <option value="high">{PRIORITY_LABELS.high[locale]}</option>
          <option value="urgent">{PRIORITY_LABELS.urgent[locale]}</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant">
          {isVi ? 'Chi tiết sự cố (tối thiểu 10 ký tự)' : 'Detailed Description (min 10 chars)'}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={
            isVi
              ? 'Mô tả chi tiết những gì bạn gặp phải...'
              : 'Describe what happened, error message, or steps to reproduce...'
          }
          className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-variant/20 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-hidden"
          maxLength={5000}
          required
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-outline-variant/40 px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant/20"
        >
          {isVi ? 'Hủy' : 'Cancel'}
        </button>
        <button
          type="submit"
          data-testid="button-submit-ticket"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {isSubmitting
            ? isVi
              ? 'Đang gửi...'
              : 'Sending...'
            : isVi
              ? 'Gửi Ticket'
              : 'Submit Ticket'}
        </button>
      </div>
    </form>
  );
}
