/**
 * RaaS Gateway v2.0.0 Client
 *
 * Communicates with raas.agencyos.network
 * Supports JWT + mk_ API key authentication
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  RaasGatewayConfig,
  RaasUsageMetrics,
  BillingMetrics,
  LicenseUtilization,
  CacheEntry,
} from './raas-gateway-types';

// Re-export types so consumers can import from the single entry point
export type {
  RaasGatewayConfig,
  RaasUsageMetrics,
  BillingMetrics,
  LicenseUtilization,
  QuotaTrend,
} from './raas-gateway-types';

export class RaasGatewayClient {
  private config: RaasGatewayConfig;
  private cache: Map<string, CacheEntry>;
  private jwt: string;
  private jwtExpiresAt: number;

  constructor(config: RaasGatewayConfig) {
    this.config = config;
    this.cache = new Map();
    this.jwt = '';
    this.jwtExpiresAt = 0;
  }

  // ---- Authentication ----

  async authenticate(): Promise<string> {
    if (this.jwt && this.jwtExpiresAt > Date.now() + 5 * 60 * 1000) {
      return this.jwt;
    }

    const response = await fetch(`${this.config.baseURL}/api/v2/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RaaS-API-Key': this.config.apiKey,
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const data = await response.json() as { jwt?: string; expiresIn?: number };
    this.jwt = data.jwt || '';
    this.jwtExpiresAt = Date.now() + (data.expiresIn || 3600) * 1000;
    return this.jwt;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/v2/auth/validate`, {
        method: 'GET',
        headers: { 'X-RaaS-API-Key': this.config.apiKey },
        signal: AbortSignal.timeout(this.config.timeout),
      });
      return response.ok;
    } catch (error) {
      logger.error('[RaaS] API key validation failed', toError(error));
      return false;
    }
  }

  // ---- Metrics endpoints ----

  async getUsageMetrics(start: number, end: number): Promise<RaasUsageMetrics> {
    const cacheKey = `usage-${start}-${end}`;
    const cached = this.getFromCache<RaasUsageMetrics>(cacheKey);
    if (cached) return cached;

    const jwt = await this.authenticate();
    const response = await fetch(
      `${this.config.baseURL}/api/v2/metrics/usage?start=${start}&end=${end}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.config.timeout),
      }
    );

    if (!response.ok) throw new Error(`Failed to fetch usage metrics: ${response.statusText}`);

    const data = await response.json() as RaasUsageMetrics;
    this.setCache(cacheKey, data, 300000);
    return data;
  }

  async getBillingMetrics(period: string): Promise<BillingMetrics> {
    const cacheKey = `billing-${period}`;
    const cached = this.getFromCache<BillingMetrics>(cacheKey);
    if (cached) return cached;

    const jwt = await this.authenticate();
    const response = await fetch(
      `${this.config.baseURL}/api/v2/metrics/billing?period=${period}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.config.timeout),
      }
    );

    if (!response.ok) throw new Error(`Failed to fetch billing metrics: ${response.statusText}`);

    const data = await response.json() as BillingMetrics;
    this.setCache(cacheKey, data, 300000);
    return data;
  }

  async getLicenseUtilization(): Promise<LicenseUtilization[]> {
    const cacheKey = `licenses-utilization`;
    const cached = this.getFromCache<LicenseUtilization[]>(cacheKey);
    if (cached) return cached;

    const jwt = await this.authenticate();
    const response = await fetch(`${this.config.baseURL}/api/v2/licenses/utilization`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) throw new Error(`Failed to fetch license utilization: ${response.statusText}`);

    const data = await response.json() as LicenseUtilization[];
    this.setCache(cacheKey, data, 300000);
    return data;
  }

  // ---- Real-time updates ----

  subscribeToMetrics(callback: (metrics: RaasUsageMetrics) => void): () => void {
    try {
      const ws = new WebSocket(
        `${this.config.baseURL.replace('https://', 'wss://').replace('http://', 'ws://')}/api/v2/realtime`
      );

      ws.onopen = () => {
        logger.info('[RaaS] WebSocket connection established');
        ws.send(JSON.stringify({ type: 'authenticate', apiKey: this.config.apiKey }));
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'metrics') callback(data.payload);
      };
      ws.onerror = () => logger.error('[RaaS] WebSocket error', new Error('WebSocket error event'));
      ws.onclose = () => logger.info('[RaaS] WebSocket connection closed');

      return () => ws.close();
    } catch (error) {
      logger.error('[RaaS] WebSocket connection failed', toError(error));
      const interval = setInterval(async () => {
        try {
          const now = Date.now();
          callback(await this.getUsageMetrics(now - 3600000, now));
        } catch (err) {
          logger.error('[RaaS] Polling failed', toError(err));
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }

  // ---- Cache helpers ----

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.data as T;
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, { data: data as CacheEntry['data'], expiresAt: Date.now() + ttl });
  }
}
