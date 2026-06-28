/**
 * Test data factory — generates consistent test data for E2E tests.
 * Centralizes test data creation to avoid duplication and ensure valid states.
 */

export interface UserData {
  email: string;
  password: string;
  name?: string;
  tier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
}

export interface CampaignData {
  name: string;
  description?: string;
  budget?: number;
  status?: 'draft' | 'active' | 'paused' | 'completed';
}

export interface AffiliateData {
  name: string;
  email: string;
  commissionRate: number;
  status?: 'active' | 'inactive' | 'pending';
}

export class TestDataFactory {
  static generateUser(overrides?: Partial<UserData>): UserData {
    const timestamp = Date.now();
    return {
      email: `test-${timestamp}@sophia.test`,
      password: `TestPass${timestamp}!`,
      name: `Test User ${timestamp}`,
      tier: 'BASIC',
      ...overrides,
    };
  }

  static generateCampaign(overrides?: Partial<CampaignData>): CampaignData {
    const timestamp = Date.now();
    return {
      name: `Test Campaign ${timestamp}`,
      description: 'E2E test campaign',
      budget: 1000,
      status: 'draft',
      ...overrides,
    };
  }

  static generateAffiliate(overrides?: Partial<AffiliateData>): AffiliateData {
    const timestamp = Date.now();
    return {
      name: `Test Affiliate ${timestamp}`,
      email: `affiliate-${timestamp}@sophia.test`,
      commissionRate: 10,
      status: 'pending',
      ...overrides,
    };
  }

  static generateApiKeyName(): string {
    return `E2E Test Key ${Date.now()}`;
  }
}
