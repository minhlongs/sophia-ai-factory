export interface ServiceHealth {
  status: 'up' | 'down' | 'configured' | 'missing_config';
  latency?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Record<string, ServiceHealth>;
}
