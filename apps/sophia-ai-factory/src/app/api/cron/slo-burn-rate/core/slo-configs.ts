import type { SLOConfig } from './types';

export const SLO_CONFIGS: SLOConfig[] = [
  {
    name: 'availability',
    targetValue: 0.995, // 99.5%
    targetOperator: 'gte',
    routes: ['/api/', '/dashboard/', '/webhook/'],
  },
  {
    name: 'error_rate',
    targetValue: 0.01, // 1%
    targetOperator: 'lte',
    routes: ['/api/', '/webhook/'],
  },
  {
    name: 'api_latency_p95',
    targetValue: 800, // 800ms
    targetOperator: 'lte',
    routes: ['/api/'],
    thresholdMs: 800,
  },
  {
    name: 'health_latency_p95',
    targetValue: 500, // 500ms
    targetOperator: 'lte',
    routes: ['/api/health', '/api/version'],
    thresholdMs: 500,
  },
  {
    name: 'webhook_delivery_p95',
    targetValue: 300000, // 5 minutes = 300000ms
    targetOperator: 'lte',
    routes: ['/webhook/'],
    thresholdMs: 300000,
  },
];
