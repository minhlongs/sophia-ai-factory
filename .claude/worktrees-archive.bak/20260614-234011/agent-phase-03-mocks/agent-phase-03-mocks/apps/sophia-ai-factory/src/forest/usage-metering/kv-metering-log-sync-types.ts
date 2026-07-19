/**
 * Types and config for KV Metering Log Sync
 * @module usage-metering/kv-metering-log-sync-types
 */

export interface MeteringLogEntry {
  eventId: string;
  userId: string;
  licenseNonce: string;
  service: string;
  endpoint: string;
  action: string;
  creditsUsed: number;
  tokensInput: number;
  tokensOutput: number;
  idempotencyKey: string;
  requestId?: string | null;
  tierAtRequest: string;
  externalCustomerId?: string | null;
  modelName?: string | null;
  timestamp: number;
  syncedAt: number;
  reconciledWithGateway: boolean;
  gatewayDiscrepancy?: string;
}

export interface SyncResult {
  success: boolean;
  eventsScanned: number;
  eventsSynced: number;
  eventsSkipped: number;
  errors: SyncError[];
}

export interface SyncError {
  eventId: string;
  error: string;
  timestamp: number;
}

export interface KvMeteringLogConfig {
  kvKeyPrefix: string;
  ttlSeconds: number;
  batchSize: number;
  timeRangeHours: number;
}

export const DEFAULT_KV_METERING_LOG_CONFIG: KvMeteringLogConfig = {
  kvKeyPrefix: 'metering:',
  ttlSeconds: 7 * 24 * 60 * 60,
  batchSize: 100,
  timeRangeHours: 24,
}
