import { NextRequest, NextResponse } from "next/server";

// RED-TEAM #10: Requires INTROSPECT_TOKEN bearer — returns 401 otherwise.
// Exposes binding statuses + cron last-run timestamps.

interface CloudflareEnv {
  DB?: { prepare: (sql: string) => { first: () => Promise<unknown> } };
  NEXT_INC_CACHE_R2_BUCKET?: { head: (key: string) => Promise<unknown> };
  INTROSPECT_TOKEN?: string;
  COMMIT_SHA?: string;
  DEPLOYED_AT?: string;
}

type SubsystemStatus = "ok" | "degraded" | "unknown";

interface SubsystemCheck {
  status: SubsystemStatus;
  latencyMs?: number;
  error?: string;
}

interface HealthDetailResponse {
  status: "ok" | "degraded";
  timestamp: string;
  version: string;
  subsystems: {
    d1: SubsystemCheck;
    r2: SubsystemCheck;
  };
  degraded: string[];
}

function getEnv(request: NextRequest): CloudflareEnv {
  const ctx = (request as NextRequest & { env?: CloudflareEnv }).env;
  return {
    DB: ctx?.DB,
    NEXT_INC_CACHE_R2_BUCKET: ctx?.NEXT_INC_CACHE_R2_BUCKET,
    INTROSPECT_TOKEN: ctx?.INTROSPECT_TOKEN ?? process.env.INTROSPECT_TOKEN,
    COMMIT_SHA: ctx?.COMMIT_SHA ?? process.env.COMMIT_SHA,
    DEPLOYED_AT: ctx?.DEPLOYED_AT ?? process.env.DEPLOYED_AT,
  };
}

function isAuthorized(request: NextRequest, env: CloudflareEnv): boolean {
  const token = env.INTROSPECT_TOKEN;
  if (!token) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${token}`;
}

async function checkD1(env: CloudflareEnv): Promise<SubsystemCheck> {
  if (!env.DB) return { status: "unknown", error: "D1 binding not available" };
  const t0 = Date.now();
  try {
    await env.DB.prepare("SELECT 1").first();
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      status: "degraded",
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkR2(env: CloudflareEnv): Promise<SubsystemCheck> {
  if (!env.NEXT_INC_CACHE_R2_BUCKET) {
    return { status: "unknown", error: "R2 binding not available" };
  }
  const t0 = Date.now();
  try {
    // HEAD a sentinel key — absence (null) is OK, error is not
    await env.NEXT_INC_CACHE_R2_BUCKET.head("__health_ping__");
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      status: "degraded",
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = getEnv(request);

  if (!isAuthorized(request, env)) {
    return NextResponse.json(
      { error: "Unauthorized — INTROSPECT_TOKEN required" },
      { status: 401 }
    );
  }

  const [d1, r2] = await Promise.all([checkD1(env), checkR2(env)]);

  const degraded: string[] = [];
  if (d1.status === "degraded") degraded.push("d1");
  if (r2.status === "degraded") degraded.push("r2");

  const body: HealthDetailResponse = {
    status: degraded.length > 0 ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    version: (env.COMMIT_SHA ?? "unknown").slice(0, 8),
    subsystems: { d1, r2 },
    degraded,
  };

  const httpStatus = degraded.length > 0 ? 503 : 200;
  return NextResponse.json(body, { status: httpStatus });
}
