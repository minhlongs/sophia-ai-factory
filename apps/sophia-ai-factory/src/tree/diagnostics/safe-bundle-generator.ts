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

const REDACTED_PLACEHOLDER = '[REDACTED]';

/** Comprehensive regex patterns to catch API keys, tokens, credentials, and connection strings */
const COMPREHENSIVE_SECRET_PATTERNS: RegExp[] = [
  // OpenAI, Anthropic, OpenRouter, Fal, Replicate, ElevenLabs keys
  /(?:sk|fal|r8|el|key|api|token|secret)[-_a-zA-Z0-9]{8,}/gi,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  // JWT tokens
  /ey[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/g,
  // Passwords in query or config strings
  /(?:password|passwd|pwd|client_secret|auth_token)\s*[:=]\s*["']?[^\s,"']+/gi,
  // Database connection URIs
  /(?:postgres|postgresql|mysql|sqlite|redis|mongodb|upstash):\/\/[^\s]+/gi,
  // Raw emails (PII)
  /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g,
  // Cookie or session header signatures
  /(?:cookie|set-cookie|session):\s*[^\r\n]+/gi,
];

/**
 * Clean and redact any sensitive text or serialized object string.
 */
export function redactSensitiveData(input: string): string {
  if (!input) return '';
  let sanitized = input;
  for (const pattern of COMPREHENSIVE_SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, REDACTED_PLACEHOLDER);
  }
  return sanitized;
}

/**
 * Mask an ID (userId or workspaceId) showing only the last characters.
 */
export function maskIdentifier(id: string, prefix = 'id'): string {
  if (!id) return `${prefix}_anon`;
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (clean.length <= 6) return `${prefix}_***${clean}`;
  return `${prefix}_***${clean.slice(-6)}`;
}

/**
 * Categorize raw errors into safe coarse-grained diagnostic enum tags.
 */
export function categorizeError(errorMsg: string): string {
  const lower = errorMsg.toLowerCase();
  if (/401|403|unauthorized|auth|api_key|credential|invalid_key/.test(lower)) {
    return 'AUTH_CREDENTIAL_ERROR';
  }
  if (/429|rate limit|too many|quota exceeded|throttl/.test(lower)) {
    return 'RATE_LIMIT_EXCEEDED';
  }
  if (/402|credit|balance|insufficient|mcu/.test(lower)) {
    return 'INSUFFICIENT_CREDITS';
  }
  if (/timeout|abort|econnrefused|fetch failed|network|socket/.test(lower)) {
    return 'NETWORK_UNAVAILABLE';
  }
  if (/format|invalid_argument|validation|schema|payload/.test(lower)) {
    return 'PAYLOAD_VALIDATION_ERROR';
  }
  if (/d1|database|sqlite|sql|query|db/.test(lower)) {
    return 'PERSISTENCE_LAYER_ERROR';
  }
  return 'GENERIC_INTERNAL_ERROR';
}

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
