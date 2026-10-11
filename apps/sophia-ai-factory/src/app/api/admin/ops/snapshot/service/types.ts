export interface CronRunRow {
  cron_name: string;
  last_run_at: number;
  last_status: string;
  last_error: string | null;
  run_count: number;
}

export interface QueueRow {
  status: string;
  cnt: number;
}

export interface FailedVideoRow {
  id: string;
  purchase_id: string | null;
  last_error: string | null;
  created_at: number;
}

export interface ReconcileRow {
  paid: number;
  delivered: number;
}

export interface FailedCountRow {
  cnt: number;
}

export interface OutageEventRow {
  cnt: number;
  latest_at: string | null;
}

export interface OpsSnapshotResponse {
  version: {
    sha: string;
    deployedAt: string;
    opennextVersion: string;
  };
  cronRuns: CronRunRow[];
  activeQueue: {
    queued: number;
    processing: number;
    total: number;
  };
  failedPermanent24h: {
    count: number;
    samples: FailedVideoRow[];
  };
  reconcile24h: {
    paid: number;
    delivered: number;
    mismatch: number;
    failedPermanent: number;
  };
  heygenHealth: {
    healthy: boolean;
    providerStatus: string;
    checkedAt: string;
  };
  circuitBreaker: {
    state: string;
    openedAt?: number;
    recentFailures: number;
    recentSuccesses: number;
  };
  outageNotifications: {
    lastTriggeredAt: number | null;
    customersNotified24h: number;
  };
  generatedAt: string;
}
