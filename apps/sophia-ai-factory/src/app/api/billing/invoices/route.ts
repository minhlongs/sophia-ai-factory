/**
 * GET /api/billing/invoices
 *
 * Returns invoice history with overage line items
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { InvoiceRecord } from '@/lib/billing/billing-types';

/**
 * GET /api/billing/invoices
 * Returns: Invoice history array
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeOverage = searchParams.get('includeOverage') === 'true';

    // Get user's Stripe customer ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({
        invoices: [],
        message: 'No Stripe customer ID found',
      });
    }

    // Fetch invoices from payment_events table
    // In production, you'd fetch from Stripe API directly
    const { data: paymentEvents } = await supabase
      .from('payment_events')
      .select('*')
      .eq('payload->>customer', profile.stripe_customer_id)
      .in('event_type', ['invoice.paid', 'invoice.payment_failed', 'invoice.created'])
      .order('created_at', { ascending: false })
      .limit(limit) as { data: PaymentEventRow[] | null };

    if (!paymentEvents || paymentEvents.length === 0) {
      return NextResponse.json({ invoices: [] });
    }

    // Transform payment events to invoice records
    interface PaymentEventRow {
      id: string;
      stripe_event_id: string;
      event_type: string;
      created_at: string;
      payload: {
        id?: string;
        number?: string;
        amount_paid?: number;
        amount_due?: number;
        period_start?: number;
        period_end?: number;
      };
    }

    const invoices: InvoiceRecord[] = await Promise.all(
      paymentEvents.map(async (event: PaymentEventRow) => {
        const invoiceData = event.payload;
        const lineItems: Array<{ description: string; amountCents: number; type: string }> = [];

        // Add subscription line item
        const amountPaid = invoiceData.amount_paid || 0;
        if (amountPaid > 0) {
          lineItems.push({
            description: 'Subscription',
            amountCents: amountPaid,
            type: 'subscription',
          });
        }

        // Check for overage line items
        if (includeOverage) {
          const overageItems = await getOverageLineItems(
            user.id,
            invoiceData.period_start,
            invoiceData.period_end
          );
          lineItems.push(...overageItems);
        }

        return {
          id: invoiceData.id || `invoice-${event.stripe_event_id}`,
          invoiceNumber: invoiceData.number || `INV-${event.stripe_event_id.slice(0, 8)}`,
          amountPaidCents: amountPaid,
          amountDueCents: invoiceData.amount_due || 0,
          status: mapInvoiceStatus(event.event_type),
          created_at: event.created_at ? new Date(event.created_at).getTime() : Date.now(),
          periodStart: invoiceData.period_start || 0,
          periodEnd: invoiceData.period_end || 0,
          lineItems,
          stripeInvoiceId: invoiceData.id || '',
        };
      })
    );

    return NextResponse.json({ invoices });
  } catch (error) {
    logger.error('[Billing API] Error fetching invoices', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

/**
 * Map Stripe event type to invoice status
 */
function mapInvoiceStatus(eventType: string): 'paid' | 'pending' | 'failed' | 'refunded' {
  switch (eventType) {
    case 'invoice.paid':
      return 'paid';
    case 'invoice.created':
      return 'pending';
    case 'invoice.payment_failed':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Get overage line items for a specific period
 */
async function getOverageLineItems(
  userId: string,
  periodStart: number,
  periodEnd: number
): Promise<Array<{ description: string; amountCents: number; type: string }>> {
  try {
    const supabase = createAdminClient();

    const { data: overageEvents } = await supabase
      .from('overage_events')
      .select('exceeded_by, tier_at_exceeded')
      .eq('user_id', userId)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .eq('billable', true);

    if (!overageEvents || overageEvents.length === 0) {
      return [];
    }

    // Group by tier and calculate charges
    const tierCredits: Record<string, number> = {};

    interface OverageEventRow {
      tier_at_exceeded: string;
      exceeded_by: number;
    }

    overageEvents.forEach((event: OverageEventRow) => {
      const tier = event.tier_at_exceeded || 'BASIC';
      tierCredits[tier] = (tierCredits[tier] || 0) + (event.exceeded_by || 0);
    });

    // Pricing per tier
    const pricing: Record<string, number> = {
      BASIC: 0.1,
      PREMIUM: 0.05,
      ENTERPRISE: 0.03,
      MASTER: 0.02,
    };

    return Object.entries(tierCredits).map(([tier, credits]) => ({
      description: `Overage charges (${tier}) - ${credits} credits`,
      amountCents: Math.round(credits * (pricing[tier] || 0.1) * 100),
      type: 'overage',
    }));
  } catch (error) {
    logger.error('[Billing API] Error fetching overage line items', error as Error);
    return [];
  }
}
