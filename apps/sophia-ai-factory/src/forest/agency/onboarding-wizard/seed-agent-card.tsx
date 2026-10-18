'use client';

import React from 'react';
import type {
  SeedAgentDeploymentConfig,
  AgyAutonomyLevel,
  EscalationAction,
} from '@/seed/types';
import { SeedAgentControls } from './seed-agent-controls';

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
          <SeedAgentControls
            agent={agent}
            idx={idx}
            handleUpdateAgentAutonomy={handleUpdateAgentAutonomy}
            handleUpdateAgentMcu={handleUpdateAgentMcu}
            handleUpdateAgentEscalation={handleUpdateAgentEscalation}
            isVi={isVi}
          />
        )}
      </div>
    </div>
  );
}
