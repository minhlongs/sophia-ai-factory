import { resolvers } from '@/land/analytics/graphql-resolvers';
import {
  AnalyticsUsageGranularity,
  AnalyticsRevenuePeriod,
  AnalyticsLicenseStatus,
} from './types';

export async function resolveAnalyticsQuery(
  queryString: string,
  _variables?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const analyticsResult: Record<string, unknown> = {};

  // Check for usage query
  const usageMatch = queryString.match(
    /usage\s*\(\s*start:\s*(\d+)\s*,\s*end:\s*(\d+)(?:\s*,\s*granularity:\s*(\w+))?(?:\s*,\s*licenseNonce:\s*"([^"]+)")?/,
  );
  if (usageMatch) {
    const args = {
      start: parseInt(usageMatch[1], 10),
      end: parseInt(usageMatch[2], 10),
      granularity: (usageMatch[3] as AnalyticsUsageGranularity) || 'hour',
      licenseNonce: usageMatch[4],
    };
    if (resolvers.Analytics?.usage) {
      analyticsResult.usage = await resolvers.Analytics.usage({}, args);
    }
  }

  // Check for revenue query
  const revenueMatch = queryString.match(/revenue\s*\(\s*period:\s*"([^"]+)"/);
  if (revenueMatch) {
    const args = { period: revenueMatch[1] as AnalyticsRevenuePeriod };
    if (resolvers.Analytics?.revenue) {
      analyticsResult.revenue = await resolvers.Analytics.revenue({}, args);
    }
  }

  // Check for licenses query
  const licensesMatch = queryString.match(/licenses\s*\(\s*status:\s*"([^"]+)"/);
  if (licensesMatch) {
    const args = { status: licensesMatch[1] as AnalyticsLicenseStatus };
    if (resolvers.Analytics?.licenses) {
      analyticsResult.licenses = await resolvers.Analytics.licenses({}, args);
    }
  }

  // Check for roi query
  const roiMatch = queryString.match(/roi\s*\(\s*licenseNonce:\s*"([^"]+)"/);
  if (roiMatch) {
    const args = { licenseNonce: roiMatch[1] };
    if (resolvers.Analytics?.roi) {
      analyticsResult.roi = await resolvers.Analytics.roi({}, args);
    }
  }

  return analyticsResult;
}
