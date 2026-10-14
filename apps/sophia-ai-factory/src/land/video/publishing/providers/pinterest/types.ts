/**
 * Pinterest Publisher API types and contracts.
 */

export interface PinRegisterResponse {
  upload_id: string;
  upload_url: string;
  upload_parameters?: Record<string, string>;
}

export interface PinCreateResponse {
  id: string;
}

export interface PinStatsResponse {
  impression?: number;
  save?: number;
  outbound_click?: number;
  pin_click?: number;
}
