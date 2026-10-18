'use client';

import React from 'react';
import type {
  SeedAgentDeploymentConfig,
  AgyAutonomyLevel,
  EscalationAction,
} from '@/seed/types';

export interface SeedAgentCardProps {
  agent: SeedAgentDeploymentConfig;
  idx: number;
  handleToggleAgent: (idx: number) => void;
  handleUpdateAgentAutonomy: (idx: number, level: AgyAutonomyLevel) => void;
  handleUpdateAgentMcu: (idx: number, mcu: number) => void;
  handleUpdateAgentEscalation: (idx: number, policy: EscalationAction) => void;
  isVi: boolean;
}

function getAgentRoleDescription(role: string, isVi: boolean): string {
  if (role === 'video_creator') {
    return isVi
      ? 'Tự động tạo kịch bản video, ghép cảnh và xuất bản thảo.'
      : 'Generates avatar drafts, UGC clips, and marketing videos.';
  }
  if (role === 'ugc_reviewer') {
    return isVi
      ? 'Tiếp nhận ý kiến đánh giá theo dòng thời gian từ khách hàng.'
      : 'Captures client feedback, timecoded notes, and revision requests.';
  }
  return isVi
    ? 'Tự động gửi thông báo cập nhật tiến độ đến khách hàng.'
    : 'Automates notification dispatches and client follow-ups.';
}

export function SeedAgentCard({
  agent,
  idx,
  handleToggleAgent,
  handleUpdateAgentAutonomy,
  handleUpdateAgentMcu,
  handleUpdateAgentEscalation,
  isVi,
}: SeedAgentCardProps) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        agent.enabled
          ? 'bg-card border-border shadow-sm'
          : 'bg-muted/30 border-border/50 opacity-60'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={agent.enabled}
            onChange={() => handleToggleAgent(idx)}
            className="w-4 h-4 rounded text-primary border-input mt-1 cursor-pointer"
          />
          <div>
            <div className="font-semibold text-sm text-foreground flex items-center gap-2">
              {agent.name}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {agent.role}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getAgentRoleDescription(agent.role, isVi)}
            </p>
          </div>
        </div>

        {agent.enabled && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end pt-2 sm:pt-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {isVi ? 'Tự chủ:' : 'Autonomy:'}
              </span>
              <select
                value={agent.maxAutonomy}
                onChange={(e) =>
                  handleUpdateAgentAutonomy(idx, e.target.value as AgyAutonomyLevel)
                }
                className="px-2 py-1 bg-background border border-input rounded text-xs text-foreground"
              >
                <option value="L0">{isVi ? 'Thủ công (L0)' : 'Manual (L0)'}</option>
                <option value="L1">{isVi ? 'Có giám sát (L1)' : 'Assisted (L1)'}</option>
                <option value="L2">{isVi ? 'Theo dõi (L2)' : 'Monitored (L2)'}</option>
                <option value="L3">{isVi ? 'Tự động (L3)' : 'Autonomous (L3)'}</option>
                <option value="L4">{isVi ? 'Tối cao (L4)' : 'Sovereign (L4)'}</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">MCU:</span>
              <input
                type="number"
                min="10"
                step="10"
                value={agent.maxComputeUnitsMcu}
                onChange={(e) =>
                  handleUpdateAgentMcu(idx, parseInt(e.target.value, 10) || 0)
                }
                className="w-16 px-2 py-1 bg-background border border-input rounded text-xs text-foreground font-mono"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {isVi ? 'Xử lý vượt:' : 'Over-quota:'}
              </span>
              <select
                value={agent.escalationPolicy}
                onChange={(e) =>
                  handleUpdateAgentEscalation(idx, e.target.value as EscalationAction)
                }
                className="px-2 py-1 bg-background border border-input rounded text-xs text-foreground"
              >
                <option value="escalate_human">
                  {isVi ? 'Báo quản trị' : 'Alert Admin'}
                </option>
                <option value="request_approval">
                  {isVi ? 'Yêu cầu duyệt' : 'Request Approval'}
                </option>
                <option value="halt">{isVi ? 'Dừng hẳn' : 'Halt'}</option>
                <option value="degrade_gracefully">
                  {isVi ? 'Giảm tải an toàn' : 'Degrade Gracefully'}
                </option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
