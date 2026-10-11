export interface HandoverData {
  handoverId: string;
  agencyName: string;
  tier: string;
  firstLoginAt: string | null;
  firstSopInstallAt: string | null;
  firstRunAt: string | null;
  status: string;
}

export interface AgencyCardProps {
  handover: HandoverData;
}

export interface MilestonesCardProps {
  handover: HandoverData;
  fmtDate: (ts: string | null) => string;
}

export interface MilestoneRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  done: boolean;
}
