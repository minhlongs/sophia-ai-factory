/**
 * Sanitized Diagnostic Bundle Generator
 * Creates safe, redacted diagnostic payloads for customer troubleshooting.
 * ABSOLUTELY EXCLUDES: API keys, passwords, database strings, video transcripts, or PII.
 *
 * @module components/support/diagnostic-bundle-generator
 */

import type { SafeDiagnosticBundle } from '@/tree/diagnostics/safe-bundle-generator';
import {
  sanitizeText,
  maskTenantId,
  classifyErrorToCategory,
} from './diagnostic-sanitizer';

export { sanitizeText, maskTenantId, classifyErrorToCategory };

export interface ActiveProviderStatus {
  name: string;
  configured: boolean;
  status: 'ACTIVE' | 'NOT_CONFIGURED' | 'DEGRADED' | 'UNKNOWN';
}

export interface DiagnosticBundleInput {
  userId: string;
  appVersion?: string;
  commitSha?: string;
  providers?: ActiveProviderStatus[];
  recentErrors?: string[];
  systemHealth?: string;
  runtimeEnv?: string;
}

export interface SanitizedDiagnosticBundle {
  reportId: string;
  generatedAt: string;
  app: {
    name: string;
    version: string;
    commitSha: string;
    environment: string;
  };
  tenant: {
    maskedId: string;
  };
  system: {
    healthStatus: string;
  };
  providers: ActiveProviderStatus[];
  diagnostics: {
    recentErrorCategories: string[];
    sanitizationNotice: string;
  };
  verification: {
    isSanitized: boolean;
    excludedElements: string[];
  };
}

export function generateDiagnosticBundle(input: DiagnosticBundleInput): SanitizedDiagnosticBundle {
  const reportId = `diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const categories = (input.recentErrors ?? [])
    .map((err) => classifyErrorToCategory(err))
    .filter((cat, idx, self) => self.indexOf(cat) === idx);

  const cleanProviders = (input.providers ?? []).map((p) => ({
    name: sanitizeText(p.name),
    configured: Boolean(p.configured),
    status: p.status,
  }));

  return {
    reportId,
    generatedAt: now,
    app: {
      name: 'Sophia AI Factory',
      version: input.appVersion ?? '0.1.5',
      commitSha: input.commitSha ? input.commitSha.slice(0, 8) : 'unknown',
      environment: input.runtimeEnv ?? 'production',
    },
    tenant: {
      maskedId: maskTenantId(input.userId),
    },
    system: {
      healthStatus: input.systemHealth ?? 'READY',
    },
    providers: cleanProviders,
    diagnostics: {
      recentErrorCategories: categories.length > 0 ? categories : ['NONE_DETECTED'],
      sanitizationNotice:
        'All confidential API tokens, passwords, database URLs, and customer content have been purged.',
    },
    verification: {
      isSanitized: true,
      excludedElements: [
        'api_keys',
        'passwords',
        'database_connection_strings',
        'video_transcripts',
        'personally_identifiable_information',
      ],
    },
  };
}

export function downloadDiagnosticBundle(
  bundle: SanitizedDiagnosticBundle | SafeDiagnosticBundle,
  filename?: string,
): void {
  const jsonContent = JSON.stringify(bundle, null, 2);
  const maskedId = 'tenant' in bundle ? bundle.tenant.maskedId : bundle.context.maskedUserId;
  const name = filename || `sophia-diagnostic-${maskedId}-${Date.now()}.json`;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', name);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
