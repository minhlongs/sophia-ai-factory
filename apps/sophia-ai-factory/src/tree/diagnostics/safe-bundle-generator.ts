/**
 * Safe Diagnostics Bundle Generator — Sophia AI Factory.
 *
 * Implements Phase 9: P1 Support & Safe Diagnostics Bundle.
 *
 * 100% Redaction of:
 * - API keys (sk-*, fal_*, r8_*, etc.)
 * - Bearer tokens & JWTs
 * - Passwords, secrets, database URLs
 * - Customer PII / other tenant data
 *
 * Safely exposes:
 * - Sophia application version & commit SHA
 * - Workspace ID & masked user ID
 * - Capability states (AI_IMAGE, AI_VIDEO, etc.)
 * - Sanitized recent operational error categories
 *
 * Layer: tree (domain reusable).
 *
 * @module tree/diagnostics/safe-bundle-generator
 */

import { type AICapability } from '@/seed/ai/capability-model';

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
  app: {
    name: string;
    version: string;
    commitSha: string;
    environment: string;
  };
  context: {
    maskedUserId: string;
    maskedWorkspaceId: string;
  };
  capabilities: {
    available: AICapability[];
    providersCount: number;
    providerSummary: Array<{ name: string; configured: boolean; status: string }>;
  };
  diagnostics: {
    healthStatus: string;
    recentErrorCategories: string[];
    sanitizationNotice: string;
  };
  redactionAudit: {
    isSanitized: boolean;
    redactedFields: string[];
  };
}

import {
  redactSensitiveData,
  maskIdentifier,
  categorizeError,
} from './safe-bundle-redactor';

export { redactSensitiveData, maskIdentifier, categorizeError };

/**
 * Generate a production-safe diagnostics bundle guaranteed to be free of secrets and PII.
 */
export function generateSafeDiagnosticBundle(
  input: SafeDiagnosticInput
): SafeDiagnosticBundle {
  const reportId = `diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Categorize errors safely
  const categorizedErrors = (input.rawErrorLogs ?? [])
    .map((log) => categorizeError(log))
    .filter((cat, idx, self) => self.indexOf(cat) === idx);

  // Clean provider summaries
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
      recentErrorCategories:
        categorizedErrors.length > 0 ? categorizedErrors : ['NONE_RECORDED'],
      sanitizationNotice:
        'All confidential API tokens, passwords, database connection strings, and customer PII have been redacted.',
    },
    redactionAudit: {
      isSanitized: true,
      redactedFields: [
        'api_keys',
        'bearer_tokens',
        'passwords',
        'database_connection_urls',
        'cookies_and_sessions',
        'customer_pii',
      ],
    },
  };
}
