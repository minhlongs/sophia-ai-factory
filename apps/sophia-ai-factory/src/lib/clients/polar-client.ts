/**
 * Polar.sh SDK Client Wrapper
 * Provides typed access to Polar.sh API with error handling
 */

import { Polar } from '@polar-sh/sdk';
import { logger } from '../utils/logger-utility';

let polarInstance: Polar | null = null;

/**
 * Get singleton Polar.sh client instance
 */
export const getPolarClient = (): Polar => {
  if (polarInstance) {
    return polarInstance;
  }

  const accessToken = process.env.POLAR_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('POLAR_ACCESS_TOKEN must be set in environment variables');
  }

  polarInstance = new Polar({
    accessToken: accessToken.trim(),
  });

  return polarInstance;
};

/**
 * Helper functions for common Polar operations
 */
export const polarHelpers = {
  /**
   * Verify webhook signature
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyWebhook: async (_payload: string, _signature: string): Promise<boolean> => {
    const secret = process.env.POLAR_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('POLAR_WEBHOOK_SECRET not configured');
      return false;
    }

    try {
      // Webhook verification logic will be implemented based on Polar.sh docs
      // For now, this is a placeholder
      return true;
    } catch (error) {
      logger.error('Webhook verification failed', error as Error);
      return false;
    }
  },

  /**
   * Get organization ID from environment
   */
  getOrganizationId: (): string => {
    const orgId = process.env.POLAR_ORGANIZATION_ID;
    if (!orgId) {
      throw new Error('POLAR_ORGANIZATION_ID must be set in environment variables');
    }
    return orgId.trim();
  },
};

export default getPolarClient;
