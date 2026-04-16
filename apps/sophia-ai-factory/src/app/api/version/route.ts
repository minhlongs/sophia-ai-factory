import { NextRequest, NextResponse } from "next/server";

// RED-TEAM #10: Public response returns short SHA only.
// Full SHA + branch + commitMsg gated behind INTROSPECT_TOKEN bearer.

interface CloudflareEnv {
  COMMIT_SHA?: string;
  DEPLOYED_AT?: string;
  DEPLOY_BRANCH?: string;
  INTROSPECT_TOKEN?: string;
}

interface PublicVersionResponse {
  shortSha: string;
  deployedAt: string;
  opennextVersion: string;
}

interface FullVersionResponse extends PublicVersionResponse {
  commitSha: string;
  branch: string;
}

const OPENNEXT_VERSION = "1.17.3";

function getEnv(request: NextRequest): CloudflareEnv {
  // CF Workers exposes env via request context; Next.js falls back to process.env
  const ctx = (request as NextRequest & { env?: CloudflareEnv }).env;
  return {
    COMMIT_SHA: ctx?.COMMIT_SHA ?? process.env.COMMIT_SHA,
    DEPLOYED_AT: ctx?.DEPLOYED_AT ?? process.env.DEPLOYED_AT,
    DEPLOY_BRANCH: ctx?.DEPLOY_BRANCH ?? process.env.DEPLOY_BRANCH,
    INTROSPECT_TOKEN: ctx?.INTROSPECT_TOKEN ?? process.env.INTROSPECT_TOKEN,
  };
}

function isIntrospectAuthorized(request: NextRequest, env: CloudflareEnv): boolean {
  const token = env.INTROSPECT_TOKEN;
  if (!token) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${token}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getEnv(request);

  const commitSha = env.COMMIT_SHA ?? "unknown";
  const shortSha = commitSha.slice(0, 8);
  const deployedAt = env.DEPLOYED_AT ?? new Date().toISOString();

  const publicBody: PublicVersionResponse = {
    shortSha,
    deployedAt,
    opennextVersion: OPENNEXT_VERSION,
  };

  if (isIntrospectAuthorized(request, env)) {
    const fullBody: FullVersionResponse = {
      ...publicBody,
      commitSha,
      branch: env.DEPLOY_BRANCH ?? "unknown",
    };
    return NextResponse.json(fullBody);
  }

  return NextResponse.json(publicBody);
}
