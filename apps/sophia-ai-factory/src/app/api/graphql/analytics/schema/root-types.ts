/**
 * Root query definitions for Analytics GraphQL schema
 */
export const rootTypeDefs = `
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
