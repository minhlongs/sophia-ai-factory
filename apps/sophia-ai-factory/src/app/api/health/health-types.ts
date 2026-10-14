/**
 * Health endpoint response contracts.
 * Layer: App Router API Route support.
 */

export interface ComponentStatus {
  status: 'ok' | 'error' | 'unknown';
  latencyMs?: number;
  error?: string;
}

export interface RealityLoopStatus {
  status: 'ok' | 'degraded' | 'unknown';
  wired: number;
  deferred: number;
  totalEventTypes: number;
  lagging: string[];
  staleEmitterTypes: string[];
  maxLagMs: number | null;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version?: { shortSha: string; commitSha: string; deployedAt: string };
  checks?: { database: 'ok' | 'degraded'; kv: 'ok' | 'degraded' };
  components?: {
    database: ComponentStatus;
    kv: ComponentStatus;
    r2: ComponentStatus;
    circuitBreaker: { status: string; openServices: string[] };
    realityLoop: RealityLoopStatus;
  };
}
