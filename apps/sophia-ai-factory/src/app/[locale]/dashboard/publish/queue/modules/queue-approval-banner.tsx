import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface QueueApprovalBannerProps {
  title?: string;
  message?: string;
  note?: string;
}

export function QueueApprovalBanner({ title, message, note }: QueueApprovalBannerProps) {
  return (
    <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-orange-800 mb-1">
            {title || 'First Publish Requires Approval'}
          </h3>
          <p className="text-orange-700 text-sm mb-3">
            {message ||
              'Your first WhatsApp publish requires explicit approval. Click "Approve" on the pending job to continue.'}
          </p>
          <p className="text-orange-600 text-xs">
            {note || 'This is a one-time security measure to prevent accidental sends.'}
          </p>
        </div>
      </div>
    </div>
  );
}
