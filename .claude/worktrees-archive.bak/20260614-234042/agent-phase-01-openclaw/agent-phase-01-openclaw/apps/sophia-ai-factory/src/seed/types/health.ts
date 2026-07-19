export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded' | 'configured' | 'not_configured' | 'missing_config';
  latency?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  /** Short commit SHA from COMMIT_SHA env (injected by wrangler-set-build-vars.sh) */
  sha?: string;
  /** ISO timestamp of deploy from DEPLOYED_AT env */
  deployedAt?: string;
  services: Record<string, ServiceHealth>;
}
