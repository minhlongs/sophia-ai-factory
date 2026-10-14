'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Send, AlertCircle, CheckCircle2, LifeBuoy } from 'lucide-react';
import {
  SupportTicketList,
  PRIORITY_LABELS,
  type TicketPriority,
  type SupportTicket,
} from './support-ticket-list';

export type { TicketPriority, SupportTicket } from './support-ticket-list';

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
    if (isOpen) void fetchTickets();
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
      setTitle(''); setDescription(''); setPriority('normal');
      void fetchTickets();
      onTicketCreated?.();
    } catch {
      setErrorMessage(isVi ? 'Lỗi kết nối mạng, vui lòng thử lại.' : 'Network error, please retry.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-xl rounded-2xl border border-outline-variant/30 bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-on-surface">{isVi ? 'Hỗ trợ Khách hàng' : 'Customer Support Desk'}</h2>
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
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" /><span>{successMessage}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant">{isVi ? 'Tiêu đề vấn đề' : 'Issue Subject'}</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isVi ? 'VD: Lỗi kết nối fal.ai...' : 'E.g., fal.ai connection timeout...'} className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-variant/20 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-hidden" maxLength={200} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant">{isVi ? 'Mức độ ưu tiên' : 'Priority Level'}</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-variant/20 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-hidden">
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
          <SupportTicketList tickets={tickets} isLoadingTickets={isLoadingTickets} isVi={isVi} />
        )}
      </div>
    </div>
  );
}
