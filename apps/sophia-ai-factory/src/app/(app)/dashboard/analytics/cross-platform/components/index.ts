// i18n-namespace: dashboard.analytics

import { CrossPlatformView } from './cross-platform-view';

export { CrossPlatformView as CrossPlatformAnalyticsClient } from './cross-platform-view';
export { MetricStatCards } from './metric-stat-cards';
export { PlatformBreakdownChart } from './platform-breakdown-chart';
export type {
  ChannelMetric,
  ROIMetric,
  CrossPlatformAnalyticsProps,
} from './types';
export { COLORS } from './types';
export default CrossPlatformView;
