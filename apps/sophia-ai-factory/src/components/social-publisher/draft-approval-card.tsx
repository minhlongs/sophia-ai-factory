/**
 * Draft Approval Card Component
 * Obsidian Cyber-Glass card for CEO 1-click video publishing approval.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any
 * @module components/social-publisher/draft-approval-card
 */

'use client';

import React, { useState } from 'react';
import type { StoredPublishJob } from '@/land/social/publish-job-store';
import { Play } from 'lucide-react';
import {
  DraftApproveButton,
  DraftPlatformBadge,
} from './draft-approval-card-parts';

export interface DraftApprovalCardProps {
  draft: StoredPublishJob;
  onApprove: (jobId: string) => Promise<boolean>;
  onPreview?: (draft: StoredPublishJob) => void;
}

export function DraftApprovalCard({ draft, onApprove, onPreview }: DraftApprovalCardProps) {
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  const handleApprove = async () => {
    if (approving || approved) return;
    setApproving(true);
    try {
      const ok = await onApprove(draft.id);
      if (ok) setApproved(true);
    } finally {
      setApproving(false);
    }
  };

  const formattedDate = new Date(draft.createdAt).toLocaleDateString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <div className="p-4 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <DraftPlatformBadge platform={draft.platform} />
          <span className="text-[11px] text-slate-400 font-mono">{formattedDate}</span>
        </div>

        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
          {draft.title}
        </h4>

        {draft.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
            {draft.description}
          </p>
        )}

        {draft.tags && draft.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {draft.tags.slice(0, 4).map((tag, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-500"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(draft)}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Play className="w-3 h-3" />
            <span>Xem trước</span>
          </button>
        )}

        <DraftApproveButton
          approving={approving}
          approved={approved}
          onClick={() => {
            void handleApprove();
          }}
        />
      </div>
    </div>
  );
}
