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

  const handleApprove = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      const res = await fetch(`/dashboard/admin/sop-reviews/${listingId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // network or fetch error
    } finally {
      setIsPending(false);
    }
  };

  const handleReject = async () => {
    if (isPending) return;
    const reason = window.prompt(labels.rejectPrompt);
    setIsPending(true);
    try {
      const res = await fetch(`/dashboard/admin/sop-reviews/${listingId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || labels.defaultRejectReason }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // network or fetch error
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex gap-2">
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
  );
}
