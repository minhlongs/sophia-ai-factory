export interface ExperimentVariant {
  key: string;
  value: unknown;
}

export interface SopExperiment {
  id: string;
  sopTemplateId: string;
  parameterKey: string;
  variants: ExperimentVariant[];
  trafficPct: number;
  status: 'draft' | 'active' | 'concluded' | 'archived';
  winnerKey: string | null;
  createdBy: string;
  createdAt: number;
}

export interface ExperimentEvaluation {
  experimentId: string;
  totalAssignments: number;
  variantStats: Array<{
    variantKey: string;
    count: number;
    withOutcome: number;
    avgQualityScore: number | null;
  }>;
}
