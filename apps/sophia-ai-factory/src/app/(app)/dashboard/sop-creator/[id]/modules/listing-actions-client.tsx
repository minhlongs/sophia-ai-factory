'use client';

import React from 'react';
import { Edit, Send, Clock, Archive, ExternalLink } from 'lucide-react';

interface ListingActionsClientProps {
  listingId: string;
  locale: string;
  status: string;
  labels: {
    edit: string;
    submitForReview: string;
    underReview: string;
    archive: string;
    archived: string;
    viewInMarketplace: string;
  };
}

export function ListingActionsClient({
  listingId,
  locale,
  status,
  labels,
}: ListingActionsClientProps) {
  const submitForReview = async () => {
    const res = await fetch(`/${locale}/dashboard/sop-creator/${listingId}/submit-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      window.location.reload();
    }
  };

  const archiveListing = async () => {
    if (!confirm('Are you sure you want to archive this listing?')) return;
    const res = await fetch(`/${locale}/dashboard/sop-creator/${listingId}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-wrap gap-4">
      {status === 'draft' && (
        <>
          <a
            href={`/${locale}/dashboard/sop-creator/${listingId}/edit`}
            className="btn btn-primary"
          >
            <Edit className="w-4 h-4 mr-2" />
            {labels.edit}
          </a>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={submitForReview}
          >
            <Send className="w-4 h-4 mr-2" />
            {labels.submitForReview}
          </button>
        </>
      )}
      {status === 'pending_review' && (
        <span className="btn btn-secondary flex items-center gap-2 opacity-50 cursor-not-allowed">
          <Clock className="w-4 h-4" />
          {labels.underReview}
        </span>
      )}
      {status === 'published' && (
        <>
          <a
            href={`/${locale}/dashboard/sop-creator/${listingId}/edit`}
            className="btn btn-secondary"
          >
            <Edit className="w-4 h-4 mr-2" />
            {labels.edit}
          </a>
          <button
            type="button"
            className="btn btn-destructive"
            onClick={archiveListing}
          >
            <Archive className="w-4 h-4 mr-2" />
            {labels.archive}
          </button>
        </>
      )}
      {status === 'archived' && (
        <span className="btn btn-secondary flex items-center gap-2 opacity-50 cursor-not-allowed">
          <Archive className="w-4 h-4" />
          {labels.archived}
        </span>
      )}
      <a
        href={`/${locale}/dashboard/sop-marketplace/${listingId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        {labels.viewInMarketplace}
      </a>
    </div>
  );
}
