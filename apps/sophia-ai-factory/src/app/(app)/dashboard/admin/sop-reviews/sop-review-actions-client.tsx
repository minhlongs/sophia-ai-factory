'use client';

import { useState } from 'react';
import { Eye, Check, X } from 'lucide-react';

export interface SopReviewActionsClientProps {
  listingId: string;
  locale: string;
  labels: {
    view: string;
    approve: string;
    reject: string;
    rejectPrompt: string;
    defaultRejectReason: string;
  };
}

export function SopReviewActionsClient({
  listingId,
  locale,
  labels,
}: SopReviewActionsClientProps) {
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (isPending) return;
    setIsPending(true);
    setActionError(null);
    try {
      const { getCsrfHeaders } = await import('@/seed/security/use-csrf-token');
      const res = await fetch(`/dashboard/admin/sop-reviews/${listingId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(payload.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsPending(false);
    }
  };

  const handleReject = async () => {
    if (isPending) return;
    const reason = window.prompt(labels.rejectPrompt);
    if (reason === null) return;
    setIsPending(true);
    setActionError(null);
    try {
      const { getCsrfHeaders } = await import('@/seed/security/use-csrf-token');
      const res = await fetch(`/dashboard/admin/sop-reviews/${listingId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ reason: reason || labels.defaultRejectReason }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(payload.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {actionError ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {actionError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
      <a
        href={`/${locale}/dashboard/sop-creator/${listingId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-sm btn-secondary"
      >
        <Eye className="w-4 h-4 mr-1" />
        {labels.view}
      </a>
      <button
        type="button"
        disabled={isPending}
        className="btn btn-sm btn-primary"
        onClick={handleApprove}
      >
        <Check className="w-4 h-4 mr-1" />
        {labels.approve}
      </button>
      <button
        type="button"
        disabled={isPending}
        className="btn btn-sm btn-destructive"
        onClick={handleReject}
      >
        <X className="w-4 h-4 mr-1" />
        {labels.reject}
      </button>
      </div>
    </div>
  );
}
