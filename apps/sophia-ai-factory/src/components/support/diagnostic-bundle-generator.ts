/**
 * Sanitized Diagnostic Bundle Generator
 * Creates safe, redacted diagnostic payloads for customer troubleshooting.
 * ABSOLUTELY EXCLUDES: API keys, passwords, database strings, video transcripts, or PII.
 *
 * @module components/support/diagnostic-bundle-generator
 */

import type { SafeDiagnosticBundle } from '@/tree/diagnostics/safe-bundle-generator';

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

const REDACTED_MARKER = '[REDACTED]';

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_\-]{8,}/g,
  /Bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /ey[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/g,
  /password\s*[:=]\s*[^\s,]+/gi,
  /(postgres|mysql|sqlite|redis|mongodb):\/\/[^\s]+/gi,
  /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g,
];

export function sanitizeText(input: string): string {
  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, REDACTED_MARKER);
  }
  return result;
}

export function maskTenantId(userId: string): string {
  if (!userId) return 'usr_anon';
  const clean = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (clean.length <= 6) return `usr_***${clean}`;
  return `usr_***${clean.slice(-6)}`;
}

export function classifyErrorToCategory(rawError: string): string {
  const err = rawError.toLowerCase();
  if (/401|403|unauthorized|auth|key|invalid_api_key|expired/.test(err)) {
    return 'KEY_EXPIRED_OR_INVALID';
  }
  if (/429|rate limit|too many|quota exceeded|throttled/.test(err)) {
    return 'PROVIDER_RATE_LIMIT';
  }
  if (/402|credit|balance|insufficient|unpaid/.test(err)) {
    return 'QUOTA_EXHAUSTED';
  }
  if (/timeout|abort|econnrefused|fetch failed|network/.test(err)) {
    return 'NETWORK_TIMEOUT';
  }
  if (/safety|filter|validation|nsfw|format|unsupported/.test(err)) {
    return 'ASSET_VALIDATION_FAILED';
  }
  return 'GENERIC_OPERATIONAL_ERROR';
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
      sanitizationNotice: 'All confidential API tokens, passwords, database URLs, and customer content have been purged.',
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
  filename?: string
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
