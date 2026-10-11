/**
 * Autonomy Settings Types & Constants
 * Layer: components/autonomy
 */

export interface MissionTypePolicyRow {
  missionType: string;
  autonomyTier: number;
  requirePublishApproval: boolean;
  maxCostCentsPerRun: number | null;
  maxAutoRetries: number;
}

export interface AutonomySettingsProps {
  initialLevel: number;
  onLevelChange?: (level: number) => void;
  initialPolicies?: MissionTypePolicyRow[];
}
