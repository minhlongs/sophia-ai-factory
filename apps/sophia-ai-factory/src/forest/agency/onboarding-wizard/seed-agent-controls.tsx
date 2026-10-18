'use client';

import React from 'react';
import type {
  SeedAgentDeploymentConfig,
  AgyAutonomyLevel,
  EscalationAction,
} from '@/seed/types';

export interface SeedAgentControlsProps {
  agent: SeedAgentDeploymentConfig;
  idx: number;
  handleUpdateAgentAutonomy: (idx: number, level: AgyAutonomyLevel) => void;
  handleUpdateAgentMcu: (idx: number, mcu: number) => void;
  handleUpdateAgentEscalation: (idx: number, policy: EscalationAction) => void;
  isVi: boolean;
}

export function SeedAgentControls({
  agent,
  idx,
  handleUpdateAgentAutonomy,
  handleUpdateAgentMcu,
  handleUpdateAgentEscalation,
  isVi,
}: SeedAgentControlsProps) {
  return (
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
  );
}
