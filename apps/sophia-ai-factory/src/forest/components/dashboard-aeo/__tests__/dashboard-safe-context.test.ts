import { describe, expect, it } from 'vitest';
import {
  resolveDashboardModuleDescriptor,
  serializeSafeDashboardContext,
} from '../dashboard-context-serializer';

describe('Wave 3: Dashboard Authenticated-Safe LLM Context Serializer', () => {
  it('resolves cataloged dashboard modules in both locales', () => {
    const overview = resolveDashboardModuleDescriptor('/vi/dashboard');
    expect(overview.slug).toBe('overview');
    expect(overview.titleVi).toContain('Trung Tâm Chỉ Huy');

    const campaigns = resolveDashboardModuleDescriptor('/en/dashboard/campaigns/123');
    expect(campaigns.slug).toBe('campaigns');
    expect(campaigns.titleEn).toContain('AI Video Production Campaigns');

    const affiliates = resolveDashboardModuleDescriptor('/vi/dashboard/affiliates');
    expect(affiliates.slug).toBe('affiliate');
  });

  it('provides a clean fallback descriptor for any uncataloged dashboard module', () => {
    const custom = resolveDashboardModuleDescriptor('/vi/dashboard/analytics-lab');
    expect(custom.slug).toBe('analytics-lab');
    expect(custom.titleVi).toContain('ANALYTICS-LAB');
    expect(custom.recommendedPromptEn.length).toBeGreaterThan(15);
  });

  it('serializes safe markdown and scrubs any accidental secret in tier/params', () => {
    const md = serializeSafeDashboardContext({
      pathname: '/vi/dashboard/settings',
      isVi: true,
      tier: 'PREMIUM sk-or-v1-abcdef1234567890abcdef1234567890',
      quotaUsed: 250,
      quotaTotal: 1500,
    });

    expect(md).toContain('context_type: "sophia_dashboard_safe_export"');
    expect(md).toContain('redaction_policy: "ZERO_SECRETS_PII_SCRUBBED"');
    expect(md).not.toContain('sk-or-v1-abcdef1234567890abcdef1234567890');
    expect(md).toContain('[REDACTED_API_KEY]');
    expect(md).toContain('250 / 1500 MCU');
  });
});
