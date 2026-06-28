/**
 * GraphQL Schema for Analytics API
 *
 * Defines the GraphQL schema for analytics queries
 */

import { gql } from 'graphql-tag';

// Type definitions
export const typeDefs = gql`
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

  # Result types
  type UsageSummary {
    totalRequests: Int!
    totalTokensInput: Int!
    totalTokensOutput: Int!
    totalCredits: Int!
    avgResponseTimeMs: Float!
    errorRate: Float!
  }

  type TimeSeriesPoint {
    timestamp: Int!
    requests: Int!
    credits: Int!
    tokens: Int!
    errors: Int!
  }

  type ServiceBreakdown {
    service: String!
    requests: Int!
    credits: Int!
    percentage: Float!
  }

  type UsageMetrics {
    summary: UsageSummary!
    timeSeries: [TimeSeriesPoint!]!
    serviceBreakdown: [ServiceBreakdown!]!
  }

  type TierRevenue {
    tier: String!
    customers: Int!
    revenue: Float!
  }

  type RevenueTrend {
    date: String!
    revenue: Float!
  }

  type RevenueMetrics {
    totalRevenue: Float!
    recurringRevenue: Float!
    oneTimeRevenue: Float!
    byTier: [TierRevenue!]!
    trend: [RevenueTrend!]!
  }

  type LicenseUtilization {
    licenseNonce: String!
    tier: String!
    usedCredits: Int!
    limitCredit: Int!
    percentage: Float!
    expiresAt: Int
  }

  type LicenseMetrics {
    total: Int!
    byTier: JSON!
    utilization: [LicenseUtilization!]!
  }

  type ROIMetrics {
    projectedAnnual: Float!
    actualYTD: Float!
    paybackMonths: Int!
    costPerUsage: Float!
  }

  type UsageQueryResponse {
    data: UsageMetrics!
    metadata: QueryMetadata!
  }

  type RevenueQueryResponse {
    data: RevenueMetrics!
    metadata: QueryMetadata!
  }

  type LicensesQueryResponse {
    data: LicenseMetrics!
    metadata: QueryMetadata!
  }

  type RoiQueryResponse {
    data: ROIMetrics!
    metadata: QueryMetadata!
  }

  type QueryMetadata {
    queriedAt: String!
    period: JSON
    granularity: AnalyticsGranularity
    service: AiService
    tier: String
    status: String
    isAdmin: Boolean
  }

  # Root Analytics type
  type Analytics {
    """
    Fetch usage metrics for a given time range
    """
    usage(
      start: Int!
      end: Int!
      licenseNonce: String
      granularity: AnalyticsGranularity = hour
      service: AiService
    ): UsageMetrics!

    """
    Fetch revenue metrics for a given period
    """
    revenue(
      period: RevenuePeriod = current_month
      tier: Tier
    ): RevenueMetrics!

    """
    Fetch license utilization metrics
    """
    licenses(
      status: LicenseStatus = active
      tier: Tier
    ): LicenseMetrics!

    """
    Fetch ROI metrics for a specific license
    """
    roi(
      licenseNonce: String!
    ): ROIMetrics!
  }

  # Query root
  type Query {
    analytics: Analytics
  }
`;
