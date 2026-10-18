'use client';

/**
 * Agency Onboarding Wizard Step 4: Seed Agents.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/step-seed-agents
 */

import React from 'react';
import type {
  SeedAgentDeploymentConfig,
  AgyAutonomyLevel,
  EscalationAction,
} from '@/seed/types';
import { SeedAgentCard, type SeedAgentCardProps } from './seed-agent-card';

export { SeedAgentCard, type SeedAgentCardProps };

export interface StepSeedAgentsProps {
  seedAgents: SeedAgentDeploymentConfig[];
  handleToggleAgent: (idx: number) => void;
  handleUpdateAgentAutonomy: (idx: number, level: AgyAutonomyLevel) => void;
  handleUpdateAgentMcu: (idx: number, mcu: number) => void;
  handleUpdateAgentEscalation: (idx: number, policy: EscalationAction) => void;
  isVi: boolean;
}

export function StepSeedAgents({
  seedAgents,
  handleToggleAgent,
  handleUpdateAgentAutonomy,
  handleUpdateAgentMcu,
  handleUpdateAgentEscalation,
  isVi,
}: StepSeedAgentsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground">
          {isVi ? '4. Kích Hoạt Trợ Lý AI Tự Động' : '4. Deploy Seed Agents'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isVi
            ? 'Thiết lập các trợ lý AI với mức độ tự chủ và ngân sách điểm được kiểm soát bởi chính sách AGY.'
            : 'Configure autonomous workers governed by deterministic AGY safety and budget policies.'}
        </p>
      </div>

      <div className="space-y-3">
        {seedAgents.map((agent, idx) => (
          <SeedAgentCard
            key={agent.agentId}
            agent={agent}
            idx={idx}
            handleToggleAgent={handleToggleAgent}
            handleUpdateAgentAutonomy={handleUpdateAgentAutonomy}
            handleUpdateAgentMcu={handleUpdateAgentMcu}
            handleUpdateAgentEscalation={handleUpdateAgentEscalation}
            isVi={isVi}
          />
        ))}
      </div>
    </div>
  );
}
