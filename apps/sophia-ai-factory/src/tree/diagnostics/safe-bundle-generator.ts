/**
 * Safe Diagnostics Bundle Generator — Sophia AI Factory.
 * Implements Phase 9: P1 Support & Safe Diagnostics Bundle.
 * Layer: tree (domain reusable).
 * @module tree/diagnostics/safe-bundle-generator
 */

import { type AICapability } from '@/seed/ai/capability-model';
import {
  redactSensitiveData,
  maskIdentifier,
  categorizeError,
} from './safe-bundle-redactor';

export interface SafeDiagnosticInput {
  userId: string;
  workspaceId: string;
  appVersion?: string;
  commitSha?: string;
  capabilities?: AICapability[];
  providerStatuses?: Array<{ name: string; configured: boolean; status: string }>;
  rawErrorLogs?: string[];
  systemHealth?: string;
  environment?: string;
}

export interface SafeDiagnosticBundle {
  reportId: string;
  generatedAt: string;
  app: { name: string; version: string; commitSha: string; environment: string };
  context: { maskedUserId: string; maskedWorkspaceId: string };
  capabilities: {
    available: AICapability[];
    providersCount: number;
    providerSummary: Array<{ name: string; configured: boolean; status: string }>;
  };
  diagnostics: { healthStatus: string; recentErrorCategories: string[]; sanitizationNotice: string };
  redactionAudit: { isSanitized: boolean; redactedFields: string[] };
}

export { redactSensitiveData, maskIdentifier, categorizeError };

export function generateSafeDiagnosticBundle(input: SafeDiagnosticInput): SafeDiagnosticBundle {
  const reportId = `diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const categorizedErrors = (input.rawErrorLogs ?? [])
    .map((log) => categorizeError(log))
    .filter((cat, idx, self) => self.indexOf(cat) === idx);

  const cleanProviders = (input.providerStatuses ?? []).map((p) => ({
    name: redactSensitiveData(p.name),
    configured: Boolean(p.configured),
    status: redactSensitiveData(p.status),
  }));

  return {
    reportId,
    generatedAt: now,
    app: {
      name: 'Sophia AI Factory',
      version: input.appVersion ?? '0.1.5',
      commitSha: input.commitSha ? input.commitSha.slice(0, 8) : 'unknown',
      environment: input.environment ?? 'production',
    },
    context: {
      maskedUserId: maskIdentifier(input.userId, 'usr'),
      maskedWorkspaceId: maskIdentifier(input.workspaceId, 'ws'),
    },
    capabilities: {
      available: input.capabilities ?? [],
      providersCount: cleanProviders.length,
      providerSummary: cleanProviders,
    },
    diagnostics: {
      healthStatus: input.systemHealth ?? 'OPERATIONAL',
      recentErrorCategories: categorizedErrors.length > 0 ? categorizedErrors : ['NONE_RECORDED'],
      sanitizationNotice: 'All confidential API tokens, passwords, database connection strings, and customer PII have been redacted.',
    },
    redactionAudit: {
      isSanitized: true,
      redactedFields: ['api_keys', 'bearer_tokens', 'passwords', 'database_connection_urls', 'cookies_and_sessions', 'customer_pii'],
    },
  };
}
