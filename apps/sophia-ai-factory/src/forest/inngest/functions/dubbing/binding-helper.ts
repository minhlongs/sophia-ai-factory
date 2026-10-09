/**
 * Background Dubbing Orchestration: Cloudflare Workers AI & R2 Binding Helpers
 *
 * Layer: forest (infrastructure orchestrator & Inngest function)
 *
 * @module forest/inngest/functions/dubbing/binding-helper
 */

import type { AiBinding, R2Bucket } from './types';

export async function getAiBinding(): Promise<AiBinding | null> {
  const globalObj = globalThis as Record<string, unknown>;
  if (globalObj.AI && typeof (globalObj.AI as AiBinding).run === 'function') {
    return globalObj.AI as AiBinding;
  }
  const envDouble = globalObj.__env__ as Record<string, unknown> | undefined;
  if (envDouble?.AI && typeof (envDouble.AI as AiBinding).run === 'function') {
    return envDouble.AI as AiBinding;
  }
  const envSingle = globalObj.__env as Record<string, unknown> | undefined;
  if (envSingle?.AI && typeof (envSingle.AI as AiBinding).run === 'function') {
    return envSingle.AI as AiBinding;
  }
  const ctx = (globalObj as Record<symbol, { env?: Record<string, unknown> }>)[
    Symbol.for('__cloudflare-context__')
  ];
  if (ctx?.env?.AI && typeof (ctx.env.AI as AiBinding).run === 'function') {
    return ctx.env.AI as AiBinding;
  }
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cf = await getCloudflareContext({ async: true });
    const cfEnv = cf?.env as (Record<string, unknown> & { AI?: AiBinding }) | undefined;
    if (cfEnv?.AI && typeof cfEnv.AI.run === 'function') {
      return cfEnv.AI;
    }
  } catch {
    // Non-edge environment
  }
  return null;
}

export async function getR2Bucket(): Promise<R2Bucket | null> {
  const globalObj = globalThis as Record<string, unknown>;
  const bucket =
    globalObj.VIDEO_BUCKET ||
    (globalObj.__env__ as Record<string, unknown> | undefined)?.VIDEO_BUCKET ||
    (globalObj.__env as Record<string, unknown> | undefined)?.VIDEO_BUCKET ||
    globalObj.STORAGE_BUCKET ||
    (globalObj.__env__ as Record<string, unknown> | undefined)?.STORAGE_BUCKET ||
    (globalObj.__env as Record<string, unknown> | undefined)?.STORAGE_BUCKET;

  if (bucket && typeof (bucket as R2Bucket).get === 'function') {
    return bucket as R2Bucket;
  }

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx?.env as Record<string, unknown> | undefined;
    const cfBucket = env?.VIDEO_BUCKET || env?.STORAGE_BUCKET;
    if (cfBucket && typeof (cfBucket as R2Bucket).get === 'function') {
      return cfBucket as R2Bucket;
    }
  } catch {
    // Non-edge environment
  }
  return null;
}
