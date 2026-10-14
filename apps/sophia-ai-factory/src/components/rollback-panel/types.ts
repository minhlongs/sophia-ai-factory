export interface RollbackRecord {
  id: string;
  reason: string;
  fromStatus: string;
  toStatus: string;
  triggeredBy: string;
  rolledBackAt: number;
}

export interface RollbackPanelProps {
  missionId: string;
  missionStatus: string;
  canRollback: boolean;
  initialHistory: RollbackRecord[];
}
