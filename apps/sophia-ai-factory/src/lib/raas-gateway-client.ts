/**
 * RaaS Gateway v2.0.0 Client
 *
 * Communicates with raas.agencyos.network
 * Supports JWT + mk_ API key authentication
 */

export interface RaasGatewayConfig {
  baseURL: string; // 'https://raas.agencyos.network'
  apiKey: string; // mk_ prefix format
  timeout: number; // Default 10000ms
}

export interface RaasUsageMetrics {
  apiCallVolume: number;
  activeLicenses: number;
  costPerTenant: Record<string, number>;
  quotaConsumption: QuotaTrend[];
  timestamp: number;
}

export interface QuotaTrend {
  timestamp: number;
  used: number;
  limit: number;
  percentage: number;
}

export interface BillingMetrics {
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  byTier: {
    tier: string;
    customers: number;
    revenue: number;
  }[];
  trend: {
    date: string;
    revenue: number;
  }[];
}

export interface LicenseUtilization {
  licenseNonce: string;
  tier: string;
  usedCredits: number;
  limitCredit: number;
  percentage: number;
  expiresAt: number | null;
}

export class RaasGatewayClient {
  private config: RaasGatewayConfig;
  private cache: Map<string, { data: any; expiresAt: number }>;
  private jwt: string;
  private jwtExpiresAt: number;

  constructor(config: RaasGatewayConfig) {
    this.config = config;
    this.cache = new Map();
    this.jwt = '';
    this.jwtExpiresAt = 0;
  }

  // Authentication
  async authenticate(): Promise<string> {
    // If JWT is still valid (expires in > 5 minutes), reuse it
    if (this.jwt && this.jwtExpiresAt > Date.now() + 5 * 60 * 1000) {
      return this.jwt;
    }

    // Authenticate with mk_ API key
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

    const data = await response.json();
    this.jwt = data.jwt || '';
    this.jwtExpiresAt = Date.now() + (data.expiresIn || 3600) * 1000; // Default 1 hour

    return this.jwt;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/v2/auth/validate`, {
        method: 'GET',
        headers: {
          'X-RaaS-API-Key': this.config.apiKey,
        },
        signal: AbortSignal.timeout(this.config.timeout),
      });

      return response.ok;
    } catch (error) {
      console.error('[RaaS] API key validation failed:', error);
      return false;
    }
  }

  // Metrics endpoints
  async getUsageMetrics(start: number, end: number): Promise<RaasUsageMetrics> {
    const cacheKey = `usage-${start}-${end}`;
    const cached = this.getFromCache<RaasUsageMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    const jwt = await this.authenticate();
    const response = await fetch(
      `${this.config.baseURL}/api/v2/metrics/usage?start=${start}&end=${end}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeout),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch usage metrics: ${response.statusText}`);
    }

    const data = await response.json() as RaasUsageMetrics;
    this.setCache(cacheKey, data, 300000); // 5 minutes TTL

    return data;
  }

  async getBillingMetrics(period: string): Promise<BillingMetrics> {
    const cacheKey = `billing-${period}`;
    const cached = this.getFromCache<BillingMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    const jwt = await this.authenticate();
    const response = await fetch(
      `${this.config.baseURL}/api/v2/metrics/billing?period=${period}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeout),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch billing metrics: ${response.statusText}`);
    }

    const data = await response.json() as BillingMetrics;
    this.setCache(cacheKey, data, 300000); // 5 minutes TTL

    return data;
  }

  async getLicenseUtilization(): Promise<LicenseUtilization[]> {
    const cacheKey = `licenses-utilization`;
    const cached = this.getFromCache<LicenseUtilization[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const jwt = await this.authenticate();
    const response = await fetch(`${this.config.baseURL}/api/v2/licenses/utilization`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch license utilization: ${response.statusText}`);
    }

    const data = await response.json() as LicenseUtilization[];
    this.setCache(cacheKey, data, 300000); // 5 minutes TTL

    return data;
  }

  // Real-time updates
  subscribeToMetrics(callback: (metrics: RaasUsageMetrics) => void): () => void {
    // Try WebSocket connection
    try {
      const ws = new WebSocket(
        `${this.config.baseURL.replace('https://', 'wss://').replace('http://', 'ws://')}/api/v2/realtime`
      );

      ws.onopen = () => {
        console.log('[RaaS] WebSocket connection established');
        ws.send(JSON.stringify({
          type: 'authenticate',
          apiKey: this.config.apiKey,
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'metrics') {
          callback(data.payload);
        }
      };

      ws.onerror = (error) => {
        console.error('[RaaS] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[RaaS] WebSocket connection closed');
      };

      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('[RaaS] WebSocket connection failed:', error);
      // Fallback to polling
      const interval = setInterval(async () => {
        try {
          const now = Date.now();
          const metrics = await this.getUsageMetrics(
            now - 3600000, // Last hour
            now
          );
          callback(metrics);
        } catch (error) {
          console.error('[RaaS] Polling failed:', error);
        }
      }, 30000); // 30 seconds interval

      return () => {
        clearInterval(interval);
      };
    }
  }

  // Caching layer
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }
}
