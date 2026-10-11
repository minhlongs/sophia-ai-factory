import { NextRequest, NextResponse } from 'next/server';
import { processNowPaymentsIpn } from '@/land/billing/nowpayments-ipn-handlers';
import { logger } from '@/seed/utils/logger-utility';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import {
  getNowPaymentsIpnSecret,
  readAndLimitRequestBody,
  verifyAndParseIpnPayload,
} from './signature-verifier';
import {
  routeCommerceIpn,
  processTopupIfApplicable,
  handlePostPaymentSideEffects,
} from './payment-processor';

export async function handleNowPaymentsGet(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'nowpayments-ipn',
    timestamp: new Date().toISOString(),
    methods: ['POST'],
  });
}

export async function handleNowPaymentsPost(request: NextRequest): Promise<NextResponse> {
  const nowPaymentsIpnSecret = getNowPaymentsIpnSecret();
  if (!nowPaymentsIpnSecret) {
    logger.error('[NOWPayments Webhook] NOWPAYMENTS_IPN_SECRET not configured');
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  const bodyResult = await readAndLimitRequestBody(request);
  if (!bodyResult.success) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const signature = request.headers.get('x-nowpayments-sig');
  const verifyResult = verifyAndParseIpnPayload(bodyResult.rawBody, signature);
  if (!verifyResult.success) {
    return NextResponse.json({ error: verifyResult.error }, { status: verifyResult.status });
  }

  const ipn = verifyResult.ipn;

  const topupResponse = await processTopupIfApplicable(ipn);
  if (topupResponse) return topupResponse;

  const commerceResponse = await routeCommerceIpn(ipn);
  if (commerceResponse) return commerceResponse;

  const result = await processNowPaymentsIpn(ipn);

  if (result.message === 'Already processed') {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  if (!result.success) {
    logger.error('[NOWPayments Webhook] IPN processing failed', new Error(result.message), {
      payment_id: ipn.payment_id,
      payment_status: ipn.payment_status,
    });
    track(D1Events.PAYMENT_FAILED, 'webhook', {
      provider: 'nowpayments',
      payment_id: ipn.payment_id,
      reason: result.message,
    });
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  await handlePostPaymentSideEffects(ipn);

  return NextResponse.json({ received: true });
}
