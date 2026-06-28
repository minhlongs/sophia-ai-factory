/**
 * GraphQL Resolvers for Analytics API
 *
 * Root resolver map. Delegates Analytics.* resolution to analytics-query-resolvers.ts.
 */

import { AnalyticsResolvers } from './analytics-query-resolvers';

export const resolvers = {
  Query: {
    analytics: () => ({}), // Analytics namespace resolver
  },

  Analytics: AnalyticsResolvers,
};
