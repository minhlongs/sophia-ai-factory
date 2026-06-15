/**
 * Build metadata — reads COMMIT_SHA + DEPLOYED_AT injected by wrangler-set-build-vars.sh.
 * Both are CF Secrets (not vars), available at runtime on Workers.
 */
export interface BuildMetadata {
  sha: string;
  deployedAt: string;
}

export function getBuildMetadata(): BuildMetadata {
  return {
    sha: process.env.COMMIT_SHA ?? 'unknown',
    deployedAt: process.env.DEPLOYED_AT ?? new Date().toISOString(),
  };
}
