/**
 * Localized Payment Rail Payload Builder
 *
 * Layer: tree/rails/dispatcher
 */

import type { LocalizedPaymentIntentInput } from '@/seed/types/localized-rails';
import { generateSepaMandate } from '../sepa-direct-debit';
import { generatePromptPayQrPayload } from '../promptpay-thai-qr';
import { generatePayNowQrPayload, createGrabPaySession } from '../paynow-grabpay';
import {
  DEFAULT_PROMPTPAY_RECIPIENT,
  DEFAULT_PAYNOW_UEN,
  DEFAULT_SEPA_CREDITOR_ID,
  DEFAULT_SEPA_CREDITOR_NAME,
} from './constants';

export interface RailPayloadResult {
  qrPayload?: string;
  qrImageUrl?: string;
  mandateReference?: string;
  checkoutUrl?: string;
}

export function buildRailPayload(params: {
  input: LocalizedPaymentIntentInput;
  transactionId: string;
  totalAmount: number;
}): RailPayloadResult {
  const { input, transactionId, totalAmount } = params;
  const { rail, billingCycle, currency, orgId, userId } = input;

  let qrPayload: string | undefined;
  let qrImageUrl: string | undefined;
  let mandateReference: string | undefined;
  let checkoutUrl: string | undefined;

  switch (rail) {
    case 'SEPA_DIRECT_DEBIT': {
      if (!input.iban) {
        throw new Error('IBAN is required for SEPA Direct Debit');
      }
      const mandate = generateSepaMandate({
        creditorId: DEFAULT_SEPA_CREDITOR_ID,
        creditorName: DEFAULT_SEPA_CREDITOR_NAME,
        debtorName: input.customerName,
        debtorIban: input.iban,
        debtorBic: input.bic,
        mandateReference: `SAF-SEPA-${transactionId.slice(-8).toUpperCase()}`,
        isRecurring: billingCycle !== 'one_time',
      });
      mandateReference = mandate.mandateReference;
      break;
    }

    case 'PROMPTPAY': {
      const recipient = input.mobileNumber ?? DEFAULT_PROMPTPAY_RECIPIENT;
      const promptPayQr = generatePromptPayQrPayload({
        recipientId: recipient,
        amount: totalAmount,
        transactionReference: transactionId,
      });
      qrPayload = promptPayQr.qrString;
      qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;
      break;
    }

    case 'PAYNOW': {
      const payNowQr = generatePayNowQrPayload({
        proxyType: 'uen',
        proxyValue: DEFAULT_PAYNOW_UEN,
        amount: totalAmount,
        reference: transactionId,
      });
      qrPayload = payNowQr.qrString;
      qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;
      break;
    }

    case 'GRABPAY': {
      const session = createGrabPaySession({
        orgId,
        userId,
        amount: totalAmount,
        currency,
        idempotencyKey: input.idempotencyKey,
      });
      checkoutUrl = session.checkoutUrl;
      break;
    }

    case 'PAYOS_VIETQR': {
      // VietQR standard NAPAS 247 payload format
      const roundedVnd = Math.round(totalAmount);
      qrPayload = `00020101021238570010A000000727012700069704220113190367898880220208QRIBFTTA530370454${roundedVnd.toString().length.toString().padStart(2, '0')}${roundedVnd}5802VN62${(transactionId.length + 4).toString().padStart(2, '0')}08${transactionId}6304`;
      qrImageUrl = `https://api.vietqr.io/image/970422-19036789888-print.png?amount=${roundedVnd}&addInfo=${transactionId}&accountName=SOPHIA%20AI%20FACTORY`;
      break;
    }

    case 'NOWPAYMENTS_CRYPTO': {
      checkoutUrl = `https://nowpayments.io/payment/?iid=${transactionId}&currency=${currency}&price_amount=${totalAmount}`;
      break;
    }

    default: {
      const exhaustiveCheck: never = rail;
      throw new Error(`Unhandled payment rail: ${String(exhaustiveCheck)}`);
    }
  }

  return { qrPayload, qrImageUrl, mandateReference, checkoutUrl };
}
