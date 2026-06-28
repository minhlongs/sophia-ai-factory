/** Quota types — canonical source for cross-layer access */
export type { QuotaLimit } from './quota-limit';
export type CreditRule = { type: 'per-call' | 'per-1k-tokens'; credits?: number; creditsPer1k?: number };
export type ExportOptions = { licenseNonce?: string; userId?: string; startTimestamp: number; endTimestamp: number; service?: string; format: 'json' | 'csv' };
export interface QuotaCheckResult { allowed: boolean; remaining: { dailyCredits: number; hourlyCredits: number; dailyRequests: number; monthlyCredits: number; }; exceeded?: { type: 'daily_credits' | 'hourly_credits' | 'daily_requests' | 'monthly_credits'; limit: number; current: number; }; }
export interface CreditSlotReservation { reserved: boolean; used: number; limit: number; }
export interface CachedQuota { hourly: number; daily: number; monthly: number; requests: number; timestamp?: number; }
export interface QuotaCheckContext { userId: string; licenseNonce: string; tier: string; requestedCredits: number; endpoint?: string; service?: string; action?: string; ipAddress?: string; userAgent?: string; }
export interface QuotaConfig { softWarningThreshold: number; enableOverageBilling: boolean; failClosed: boolean; }
