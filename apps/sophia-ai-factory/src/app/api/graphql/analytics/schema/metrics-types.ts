/**
 * Metrics result type definitions for Analytics GraphQL schema
 */
export const metricsTypeDefs = `
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
`;
