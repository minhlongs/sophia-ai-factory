/**
 * Platform Adapter Interface — for platforms requiring OAuth token refresh
 * Extends base Publisher with token management capabilities
 */

import type { Publisher, PublishMeta, MetricsJson } from './publisher-interface';

export interface PlatformAdapter extends Publisher {
  /**
   * Set the access token for the platform API
   */
  setAccessToken(token: string): void;

  /**
   * Refresh the access token if expired
   * Returns the new (or existing valid) token
   */
  refreshAccessToken(): Promise<string>;

  /**
   * Check if the current token is valid
   */
  isTokenValid(): boolean;
}

export function isPlatformAdapter(
  pub: Publisher
): pub is PlatformAdapter {
  return (
    typeof pub === 'object' &&
    pub !== null &&
    'setAccessToken' in pub &&
    typeof (pub as PlatformAdapter).setAccessToken === 'function' &&
    'refreshAccessToken' in pub &&
    typeof (pub as PlatformAdapter).refreshAccessToken === 'function'
  );
}
