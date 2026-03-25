/**
 * Health Checker — Aggregates system status checks for monitoring dashboard.
 */

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms?: number;
  detail?: string;
}

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: string;
  version: string;
}

/**
 * Fetch system status from the /api/health endpoint.
 */
export async function fetchSystemStatus(baseUrl: string): Promise<SystemStatus> {
  const res = await fetch(`${baseUrl}/api/health`, { cache: 'no-store' });
  const data = await res.json();

  const checks: HealthCheck[] = Object.entries(
    data.checks as Record<string, { status: string; latency_ms?: number; error?: string }>
  ).map(([name, c]) => ({
    name,
    status: c.status as HealthCheck['status'],
    latency_ms: c.latency_ms,
    detail: c.error,
  }));

  return {
    overall: data.status,
    checks,
    timestamp: data.timestamp,
    version: data.version,
  };
}
