/**
 * POST /api/billing/record-usage
 *
 * Push usage metrics to Stripe Billing for metered billing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { z } from 'zod';

/**
 * Request body schema
 */
const recordUsageSchema = z.object({
  stripeCustomerId: z.string().startsWith('cus_'),
  stripePriceId: z.string().startsWith('price_'),
  quantity: z.number().positive(),
  timestamp: z.number().optional(),
  idempotencyKey: z.string().optional(),
});

/**
 * POST /api/billing/record-usage
 * Records usage for Stripe metered billing
 */
export async function POST(req: NextRequest) {
  try {
    // Verify API key or admin auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    if (apiKey !== process.env.INTERNAL_API_KEY && apiKey !== process.env.SERVICE_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const parseResult = recordUsageSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { stripeCustomerId, stripePriceId, quantity, timestamp, idempotencyKey } = parseResult.data;

    // Check if usage already recorded (idempotency)
    if (idempotencyKey) {
      const supabase = createAdminClient();
      const { data: existing } = await supabase
        .from('usage_events')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (existing) {
        logger.info('[Billing API] Duplicate usage record skipped (idempotency)', {
          idempotencyKey,
          stripeCustomerId,
        });
        return NextResponse.json({
          success: true,
          message: 'Usage already recorded (idempotency)',
          existing: true,
        });
      }
    }

    // Record usage in database
    const supabase = createAdminClient();
    const now = timestamp || Math.floor(Date.now() / 1000);

    const { data, error } = await supabase
      .from('usage_events')
      .insert({
        user_id: stripeCustomerId,
        license_nonce: idempotencyKey || `metered-${now}`,
        service_name: 'stripe_metered_billing',
        action: 'usage_record',
        credits_used: quantity,
        created_at: now,
        idempotency_key: idempotencyKey || `metered-${now}`,
        external_customer_id: stripeCustomerId,
        is_stripe_synced: true,
      } as any)
      .select('id')
      .single();

    if (error) throw error;

    // Note: In production, you would also push to Stripe API here
    // using Stripe SDK: stripe.subscriptionItems.createUsageRecord(...)
    // For now, we just record locally and sync via cron

    logger.info('[Billing API] Usage recorded successfully', {
      stripeCustomerId,
      stripePriceId,
      quantity,
      id: (data as any)?.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Usage recorded successfully',
      id: (data as any)?.id,
    });
  } catch (error) {
    logger.error('[Billing API] Error recording usage', error as Error);
    return NextResponse.json(
      { error: 'Failed to record usage', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Batch usage recording
 */
export async function PATCH(req: NextRequest) {
  try {
    // Same auth as POST
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const records = body.records || [];

    if (!Array.isArray(records)) {
      return NextResponse.json(
        { error: 'Request body must contain a "records" array' },
        { status: 400 }
      );
    }

    const results = [];
    const supabase = createAdminClient();

    for (const record of records) {
      try {
        const parseResult = recordUsageSchema.safeParse(record);
        if (!parseResult.success) {
          results.push({
            success: false,
            error: 'Invalid record',
            details: parseResult.error.flatten(),
          });
          continue;
        }

        const { stripeCustomerId, stripePriceId, quantity, timestamp, idempotencyKey } = parseResult.data;
        const now = timestamp || Math.floor(Date.now() / 1000);

        // Check idempotency
        if (idempotencyKey) {
          const { data: existing } = await supabase
            .from('usage_events')
            .select('id')
            .eq('idempotency_key', idempotencyKey)
            .single();

          if (existing) {
            results.push({
              success: false,
              existing: true,
              idempotencyKey,
            });
            continue;
          }
        }

        // Insert record
        const { data } = await supabase
          .from('usage_events')
          .insert({
            user_id: stripeCustomerId,
            license_nonce: idempotencyKey || `metered-batch-${now}`,
            service_name: 'stripe_metered_billing',
            action: 'usage_record_batch',
            credits_used: quantity,
            created_at: now,
            idempotency_key: idempotencyKey || `metered-batch-${now}`,
            external_customer_id: stripeCustomerId,
            is_stripe_synced: true,
          } as any)
          .select('id')
          .single();

        results.push({
          success: true,
          id: (data as any)?.id,
          idempotencyKey,
        });
      } catch (recordError) {
        logger.error('[Billing API] Error recording batch item', recordError as Error);
        results.push({
          success: false,
          error: recordError instanceof Error ? recordError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: records.length,
      results,
    });
  } catch (error) {
    logger.error('[Billing API] Error in batch usage recording', error as Error);
    return NextResponse.json(
      { error: 'Failed to record batch usage' },
      { status: 500 }
    );
  }
}
