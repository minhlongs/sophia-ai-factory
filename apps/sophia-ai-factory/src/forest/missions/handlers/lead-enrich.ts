/**
 * Handler: lead:enrich
 *
 * BYOK-aware lead enrichment via Hunter.io.
 *
 * Two-step flow when a Hunter key is present:
 *   1. /v2/email-finder — only if first_name OR last_name supplied
 *   2. /v2/email-verifier — always called with the resolved email
 *
 * Without a Hunter key, returns a deterministic stub (preserves UI flow).
 *
 * Params:
 *   - email?: string       — direct verification target (or via finder result)
 *   - first_name?: string  — finder input (Hunter accepts either name combo)
 *   - last_name?: string
 *   - domain?: string      — required for finder when email absent
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { findEmail, verifyEmail } from '@/lib/hunter/hunter-client';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from './types';

const STUB_DELAY_MS = 1000;

function buildStub(email: string) {
  const domain = email.split('@')[1] ?? 'unknown.com';
  return {
    email,
    company: domain.split('.')[0] + ' Inc',
    domain,
    first_name: null,
    last_name: null,
    position: null,
    linkedin_url: 'https://linkedin.com/in/stub-profile',
    twitter_handle: '@stub_user',
    phone: '+1-555-000-0000',
    score: 0,
    deliverable: 'unknown',
    is_stub: true,
    stub_reason: 'no_byok_key',
    upgrade_path: 'Add a Hunter.io API key in Settings > BYOK for real enrichment data',
  };
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const email = (ctx.params?.email as string) ?? '';
  const domain = (ctx.params?.domain as string) ?? '';
  const firstName = (ctx.params?.first_name as string) ?? '';
  const lastName = (ctx.params?.last_name as string) ?? '';

  if (!email && !(domain && (firstName || lastName))) {
    return {
      ok: false,
      error: 'missing_params',
      data: { hint: 'Provide either `email` OR `domain` + `first_name`/`last_name`' },
    };
  }

  const apiKey = await resolveUserApiKey(ctx.userId, 'hunter');

  if (!apiKey) {
    await new Promise((res) => setTimeout(res, STUB_DELAY_MS));
    return { ok: true, data: buildStub(email || `${firstName}.${lastName}@${domain || 'example.com'}`.toLowerCase()) };
  }

  try {
    let resolvedEmail = email;
    let finderEnvelope: Awaited<ReturnType<typeof findEmail>> | null = null;
    if (!resolvedEmail) {
      finderEnvelope = await findEmail(apiKey, {
        domain,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      });
      resolvedEmail = finderEnvelope.data.email ?? '';
    }

    if (!resolvedEmail) {
      return {
        ok: false,
        error: 'hunter_email_not_found',
        data: { hint: 'Hunter returned no email for the supplied domain + name' },
      };
    }

    const verify = await verifyEmail(apiKey, resolvedEmail);

    return {
      ok: true,
      data: {
        email: resolvedEmail,
        score: verify.data.score,
        deliverable: verify.data.result,
        status: verify.data.status,
        domain,
        first_name: finderEnvelope?.data.first_name ?? firstName ?? null,
        last_name: finderEnvelope?.data.last_name ?? lastName ?? null,
        position: finderEnvelope?.data.position ?? null,
        company: finderEnvelope?.data.company ?? null,
        linkedin_url: finderEnvelope?.data.linkedin_url ?? null,
        twitter_handle: finderEnvelope?.data.twitter ?? null,
        phone: finderEnvelope?.data.phone_number ?? null,
        sources: finderEnvelope?.data.sources ?? [],
        is_stub: false,
      },
    };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'hunter_error';
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[lead:enrich] Hunter call failed', { code, message });
    return { ok: false, error: code, data: { message } };
  }
}
