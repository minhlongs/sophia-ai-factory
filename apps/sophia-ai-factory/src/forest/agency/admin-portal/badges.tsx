/**
 * Status and Velocity Badges
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/badges
 */

import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { VelocityAlertStatus, AgencyCampaignSummary } from './types';

export function VelocityBadge({
  status,
  isVi,
}: {
  status: VelocityAlertStatus;
  isVi: boolean;
}) {
  if (status === 'exceeded') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-500">
        <ShieldAlert className="w-3 h-3" />
        {isVi ? 'Đã Vượt Hạn Mức' : 'Exceeded'}
      </span>
    );
  }
  if (status === 'near_limit') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500">
        <AlertTriangle className="w-3 h-3" />
        {isVi ? 'Sắp Hết (>80%)' : 'Near Limit'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500">
      <ShieldCheck className="w-3 h-3" />
      {isVi ? 'Bình Thường' : 'Normal'}
    </span>
  );
}

export function CampaignBadge({
  status,
  isVi,
}: {
  status: AgencyCampaignSummary['status'];
  isVi: boolean;
}) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600">
        <CheckCircle className="w-3 h-3" />
        {isVi ? 'Đã Phê Duyệt' : 'Approved'}
      </span>
    );
  }
  if (status === 'in_review') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-500">
        <Clock className="w-3 h-3" />
        {isVi ? 'Đang Chờ Khách Duyệt' : 'In Client Review'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground">
      {isVi ? 'Bản Thảo' : 'Draft'}
    </span>
  );
}
