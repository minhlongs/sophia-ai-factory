/**
 * Commerce order model — types, zod schemas, row mapping, id generation.
 *
 * Pure definitions shared by the order lifecycle operations in
 * ./commerce-order. No D1 access here.
 *
 * Timestamps are MILLISECONDS (performance_events convention).
 *
 * @module land/commerce/order-model
 */
import { z } from 'zod/v4';

export const ORDER_STATUSES = ['pending', 'paid', 'fulfilled', 'failed', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const OrderInputSchema = z.object({
  workspaceId: z.string().min(1),
  productId: z.string().min(1),
  buyerUserId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type OrderInput = z.infer<typeof OrderInputSchema>;

export interface CommerceOrder {
  id: string;
  workspaceId: string;
  productId: string;
  buyerUserId: string | null;
  quantity: number;
  amountCents: number;
  currency: string;
  status: OrderStatus;
  paymentProvider: string;
  externalPaymentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type OrderErrorCode =
  | 'INVALID_INPUT'
  | 'DB_UNAVAILABLE'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'NOT_FOUND'
  | 'WRITE_FAILED';

export interface OrderError {
  code: OrderErrorCode;
  message: string;
}

export function newOrderId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'cord_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build the idempotent revenue event id: `commerce_{productId}_{orderId}`. */
export function buildCommerceEventId(productId: string, orderId: string): string {
  return `commerce_${productId}_${orderId}`;
}

export interface OrderRow {
  id: string;
  workspace_id: string;
  product_id: string;
  buyer_user_id: string | null;
  quantity: number;
  amount_cents: number;
  currency: string;
  status: string;
  payment_provider: string;
  external_payment_id: string | null;
  metadata: string;
  created_at: number;
  updated_at: number;
}

export function rowToOrder(row: OrderRow): CommerceOrder {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    productId: row.product_id,
    buyerUserId: row.buyer_user_id,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status as OrderStatus,
    paymentProvider: row.payment_provider,
    externalPaymentId: row.external_payment_id,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
