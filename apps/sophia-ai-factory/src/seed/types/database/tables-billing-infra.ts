/**
 * Database Table Types: Sessions, Rate Limits, Telegram, Quota, Dunning & Billing
 *
 * Layer: seed/types/database
 */

import type {
  UserSessionRow,
  TelegramUserMappingRow,
} from '../user';
import type { RateLimitRow, TelegramRateLimitRow } from '../infra';
import type {
  OverageEventRow,
  OverageEventInsert,
  QuotaLimitRow,
  QuotaLimitInsert,
  QuotaLimitUpdate,
  DunningSettingsRow,
  DunningSettingsInsert,
  DunningAttemptRow,
  DunningAttemptInsert,
  BillingEventRow,
  BillingEventInsert,
} from '../billing';

export interface DatabaseBillingAndInfraTables {
  user_sessions: {
    Row: UserSessionRow;
    Insert: Omit<UserSessionRow, 'id' | 'created_at'>;
    Update: Partial<UserSessionRow>;
    Relationships: [];
  };
  rate_limits: {
    Row: RateLimitRow;
    Insert: Omit<RateLimitRow, 'id' | 'created_at'>;
    Update: Partial<RateLimitRow>;
    Relationships: [];
  };
  telegram_rate_limits: {
    Row: TelegramRateLimitRow;
    Insert: Omit<TelegramRateLimitRow, 'id' | 'created_at'>;
    Update: Partial<TelegramRateLimitRow>;
    Relationships: [];
  };
  telegram_user_mappings: {
    Row: TelegramUserMappingRow;
    Insert: Omit<TelegramUserMappingRow, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<TelegramUserMappingRow>;
    Relationships: [];
  };
  overage_events: {
    Row: OverageEventRow;
    Insert: OverageEventInsert;
    Update: Partial<OverageEventRow>;
    Relationships: [];
  };
  quota_limits: {
    Row: QuotaLimitRow;
    Insert: QuotaLimitInsert;
    Update: QuotaLimitUpdate;
    Relationships: [];
  };
  dunning_settings: {
    Row: DunningSettingsRow;
    Insert: DunningSettingsInsert;
    Update: Partial<DunningSettingsRow>;
    Relationships: [];
  };
  dunning_attempts: {
    Row: DunningAttemptRow;
    Insert: DunningAttemptInsert;
    Update: Partial<DunningAttemptRow>;
    Relationships: [];
  };
  billing_events: {
    Row: BillingEventRow;
    Insert: BillingEventInsert;
    Update: Partial<BillingEventRow>;
    Relationships: [];
  };
}
