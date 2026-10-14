/**
 * Scalar, Enum, and Input definitions for Analytics GraphQL schema
 */
export const baseTypeDefs = `
  # Scalar types
  scalar DateTime
  scalar JSON

  # Enums
  enum Tier {
    BASIC
    PREMIUM
    ENTERPRISE
    MASTER
  }

  enum AiService {
    heygen
    elevenlabs
    openrouter
  }

  enum AnalyticsGranularity {
    hour
    day
  }

  enum RevenuePeriod {
    current_month
    last_month
    last_7_days
    last_30_days
  }

  enum LicenseStatus {
    active
    expired
    revoked
    all
  }

  # Input types
  input UsageFiltersInput {
    licenseNonce: String
    startTimestamp: Int!
    endTimestamp: Int!
    granularity: AnalyticsGranularity = hour
    service: AiService
  }

  input RevenueFiltersInput {
    period: RevenuePeriod = current_month
    tier: Tier
  }

  input LicenseFiltersInput {
    status: LicenseStatus = active
    tier: Tier
  }

  input RoiFiltersInput {
    licenseNonce: String!
  }
`;
