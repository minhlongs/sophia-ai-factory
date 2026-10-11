import type { IpnPayload } from '@/land/billing/ipn-payload-schema';

export interface CommercePaymentInput {
  orderId: string;
  paymentId: string | number;
  paymentStatus: string;
  paidAmount?: number;
  paidCurrency?: string;
}

export interface WebhookHealthResponse {
  status: string;
  service: string;
  timestamp: string;
  methods: string[];
}

export type { IpnPayload };
