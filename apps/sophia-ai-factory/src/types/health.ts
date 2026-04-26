export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded' | 'configured' | 'not_configured' | 'missing_config';
  latency?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Record<string, ServiceHealth>;
}
