/**
 * Review Portal Status Banner Component
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/review-status-banner
 */

import React from 'react';
import { AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';

interface ReviewStatusBannerProps {
  isExpired?: boolean;
  isApproved: boolean;
  isChangesRequested: boolean;
  isVi: boolean;
}

export function ReviewStatusBanner({
  isExpired,
  isApproved,
  isChangesRequested,
  isVi,
}: ReviewStatusBannerProps) {
  if (isExpired) {
    return (
      <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/40 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-red-300">
            {isVi ? 'Liên kết phê duyệt đã hết hạn' : 'Review Link Expired'}
          </h2>
          <p className="text-xs text-red-400/90 mt-0.5">
            {isVi
              ? 'Liên kết này đã vượt quá thời hạn 7 ngày bảo mật. Vui lòng liên hệ Agency để được cấp liên kết mới.'
              : 'This review link has exceeded its 7-day security window. Please contact your agency for a renewed link.'}
          </p>
        </div>
      </div>
    );
  }

  if (isApproved) {
    return (
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-emerald-300">
            {isVi ? 'Bản nháp video đã được Phê duyệt' : 'Video Draft Approved'}
          </h2>
          <p className="text-xs text-emerald-400/90 mt-0.5">
            {isVi
              ? 'Video đã được xác nhận sẵn sàng và tự động kích hoạt tiến trình xuất bản đa kênh.'
              : 'Video has been verified and automatically queued for multi-channel automated distribution.'}
          </p>
        </div>
      </div>
    );
  }

  if (isChangesRequested) {
    return (
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/40 flex items-start gap-3">
        <RotateCcw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-amber-300">
            {isVi ? 'Đã yêu cầu chỉnh sửa' : 'Revisions Requested'}
          </h2>
          <p className="text-xs text-amber-400/90 mt-0.5">
            {isVi
              ? 'Đội ngũ sản xuất video đang tiếp nhận phản hồi và chuẩn bị phiên bản cập nhật.'
              : 'The video editing team has received your feedback notes and is preparing an updated cut.'}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
