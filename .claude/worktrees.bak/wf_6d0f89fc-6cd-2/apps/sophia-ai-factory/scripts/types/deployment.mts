/**
 * Deployment-related type definitions
 * Shared across pre-deploy gate, smoke tests, and alerting configs
 */

export interface SmokeCheckResult {
  name: string;
  passed: boolean;
  duration?: number;
  url?: string;
  statusCode?: number;
  error?: string;
}

export interface GateCheckResult {
  name: string;
  passed: boolean;
  reason?: string;
  severity: 'error' | 'warn' | 'skip';
}

export interface AlertPolicy {
  name: string;
  condition: string; // e.g., "error_rate > 5%"
  threshold: number;
  duration?: string; // e.g., "5m"
  severity: 'critical' | 'warning';
  channels: ('telegram' | 'email')[];
}

export interface DeployMetadata {
  commitSha: string;
  commitShort: string;
  deployedAt: string;
  branch: string;
  previousSha?: string;
}

export interface SmokeTestOptions {
  prodUrl?: string;
  expectedSha?: string;
  timeoutMs?: number;
}

export interface GateOptions {
  skipTests?: boolean;
  skipBuild?: boolean;
  skipTs?: boolean;
  skipMigrations?: boolean;
  skipSecrets?: boolean;
}
