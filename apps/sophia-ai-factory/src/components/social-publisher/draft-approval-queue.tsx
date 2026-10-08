/**
 * Draft Approval Queue Component
 * Renders the CEO 1-click video publishing approval queue.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any
 * @module components/social-publisher/draft-approval-queue
 */

'use client';

import React, { useState } from 'react';
import type { StoredPublishJob } from '@/land/social/publish-job-store';
import { DraftApprovalCard } from './draft-approval-card';
import { Sparkles, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';

export interface DraftApprovalQueueProps {
  drafts: StoredPublishJob[];
  onApproveDraft: (jobId: string) => Promise<boolean>;
  onPreviewDraft?: (draft: StoredPublishJob) => void;
  onRefresh?: () => Promise<void>;
}

export function DraftApprovalQueue({
  drafts: initialDrafts,
  onApproveDraft,
  onPreviewDraft,
  onRefresh,
}: DraftApprovalQueueProps) {
  const [drafts, setDrafts] = useState<StoredPublishJob[]>(initialDrafts);
  const [refreshing, setRefreshing] = useState(false);

  // Sync internal state when prop changes
  React.useEffect(() => {
    setDrafts(initialDrafts);
  }, [initialDrafts]);

  const handleApprove = async (jobId: string): Promise<boolean> => {
    const success = await onApproveDraft(jobId);
    if (success) {
      // Remove approved item from queue after slight delay for visual feedback
      setTimeout(() => {
        setDrafts((prev) => prev.filter((d) => d.id !== jobId));
      }, 800);
    }
    return success;
  };

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4 p-5 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#4F46E5]" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Hàng Chờ Phê Duyệt Xuất Bản / Draft Approval Queue
          </h3>
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
            {drafts.length}
          </span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Làm mới hàng chờ / Refresh queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {drafts.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Không có bản nháp nào đang chờ duyệt
            </p>
            <p className="text-[11px] text-slate-500">
              Mọi video tự động tổng hợp đều đã được duyệt hoặc đăng tự động.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map((draft) => (
            <DraftApprovalCard
              key={draft.id}
              draft={draft}
              onApprove={handleApprove}
              onPreview={onPreviewDraft}
            />
          ))}
        </div>
      )}
    </div>
  );
}
