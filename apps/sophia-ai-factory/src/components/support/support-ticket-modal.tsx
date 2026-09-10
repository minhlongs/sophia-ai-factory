'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Send, AlertCircle, CheckCircle2, LifeBuoy, Clock } from 'lucide-react';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicket {
  id: string | number;
  title: string | null;
  message: string;
  status: string;
  priority: TicketPriority;
  created_at: string;
}

export interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: 'vi' | 'en';
  onTicketCreated?: () => void;
}

export function SupportTicketModal({ isOpen, onClose, locale, onTicketCreated }: SupportTicketModalProps) {
  const isVi = locale === 'vi';
  const [tab, setTab] = useState<'create' | 'list'>('create');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  const fetchTickets = useCallback(async () => {
    setIsLoadingTickets(true);
    try {
      const res = await fetch('/api/support/tickets');
      if (res.ok) {
        const data = (await res.json()) as { tickets?: SupportTicket[] };
        setTickets(data.tickets ?? []);
      }
    } catch {
      // Non-blocking fetch error
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchTickets();
    }
  }, [isOpen, fetchTickets]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (description.trim().length < 10) {
      setErrorMessage(isVi ? 'Mô tả cần ít nhất 10 ký tự.' : 'Description must be at least 10 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined, description: description.trim(), priority }),
      });
      const data = (await res.json()) as { error?: string; ticket?: SupportTicket };
      if (!res.ok) {
        setErrorMessage(data.error || (isVi ? 'Không thể tạo ticket.' : 'Failed to submit ticket.'));
        return;
      }
      setSuccessMessage(isVi ? 'Đã gửi ticket thành công! Đội ngũ sẽ phản hồi sớm.' : 'Ticket submitted successfully!');
      setTitle('');
      setDescription('');
      setPriority('normal');
      void fetchTickets();
      onTicketCreated?.();
    } catch {
      setErrorMessage(isVi ? 'Lỗi kết nối mạng, vui lòng thử lại.' : 'Network error, please retry.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const priorityLabels: Record<TicketPriority, { vi: string; en: string }> = {
    low: { vi: 'Thấp', en: 'Low' },
    normal: { vi: 'Bình thường', en: 'Normal' },
    high: { vi: 'Cao', en: 'High' },
    urgent: { vi: 'Khẩn cấp', en: 'Urgent' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-xl rounded-2xl border border-outline-variant/30 bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-on-surface">
              {isVi ? 'Hỗ trợ Khách hàng' : 'Customer Support Desk'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-variant/30" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex gap-2 border-b border-outline-variant/20 pb-2 text-sm font-semibold">
          <button onClick={() => setTab('create')} className={`rounded-lg px-3 py-1.5 transition-colors ${tab === 'create' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}>
            {isVi ? 'Tạo Ticket mới' : 'New Ticket'}
          </button>
          <button onClick={() => setTab('list')} className={`rounded-lg px-3 py-1.5 transition-colors ${tab === 'list' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}>
            {isVi ? `Ticket của bạn (${tickets.length})` : `My Tickets (${tickets.length})`}
          </button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isVi ? 'VD: Lỗi kết nối fal.ai...' : 'E.g., fal.ai connection timeout...'} className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-variant/20 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-hidden" maxLength={200} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant">
                {isVi ? 'Mức độ ưu tiên' : 'Priority Level'}
              </label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-variant/20 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-hidden">
                <option value="low">{priorityLabels.low[locale]}</option>
                <option value="normal">{priorityLabels.normal[locale]}</option>
                <option value="high">{priorityLabels.high[locale]}</option>
                <option value="urgent">{priorityLabels.urgent[locale]}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant">
                {isVi ? 'Chi tiết sự cố (tối thiểu 10 ký tự)' : 'Detailed Description (min 10 chars)'}
              </label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={isVi ? 'Mô tả chi tiết những gì bạn gặp phải...' : 'Describe what happened, error message, or steps to reproduce...'} className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-variant/20 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-hidden" maxLength={5000} required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-outline-variant/40 px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant/20">
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button type="submit" data-testid="button-submit-ticket" disabled={isSubmitting} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50">
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? (isVi ? 'Đang gửi...' : 'Sending...') : (isVi ? 'Gửi Ticket' : 'Submit Ticket')}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1 text-sm">
            {isLoadingTickets && <p className="py-6 text-center text-xs text-on-surface-variant">{isVi ? 'Đang tải danh sách...' : 'Loading tickets...'}</p>}
            {!isLoadingTickets && tickets.length === 0 && (
              <p className="py-8 text-center text-xs text-on-surface-variant">{isVi ? 'Bạn chưa có ticket hỗ trợ nào.' : 'You have no open support tickets.'}</p>
            )}
            {!isLoadingTickets && tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-outline-variant/30 bg-surface-variant/10 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-on-surface">{t.title || (isVi ? 'Không tiêu đề' : 'Untitled')}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">{t.status}</span>
                    <span className="rounded-full bg-surface-variant/40 px-2 py-0.5 text-[10px] font-bold text-on-surface-variant uppercase">{t.priority}</span>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-on-surface-variant line-clamp-2">{t.message}</p>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-on-surface-variant/70">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(t.created_at).toLocaleString(isVi ? 'vi-VN' : 'en-US')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
