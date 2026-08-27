/**
 * Commerce product model — types, zod schemas, row mapping, id generation.
 *
 * Pure definitions shared by the catalog operations in ./product-catalog.
 * No D1 access here.
 *
 * Timestamps are MILLISECONDS (performance_events convention).
 *
 * @module land/commerce/product-model
 */
import { z } from 'zod/v4';

export const PRODUCT_TYPES = ['digital', 'access'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const ProductInputSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().min(1).optional(),
  assetRef: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

export const ProductUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).optional(),
  assetRef: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;

export interface CommerceProduct {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  productType: ProductType;
  priceCents: number;
  currency: string;
  assetRef: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type CommerceErrorCode =
  | 'INVALID_INPUT'
  | 'DB_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'WRITE_FAILED';

export interface CommerceError {
  code: CommerceErrorCode;
  message: string;
}

export function newProductId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'cprod_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ProductRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  product_type: string;
  price_cents: number;
  currency: string;
  asset_ref: string | null;
  is_active: number;
  metadata: string;
  created_at: number;
  updated_at: number;
}

export function rowToProduct(row: ProductRow): CommerceProduct {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    productType: row.product_type as ProductType,
    priceCents: row.price_cents,
    currency: row.currency,
    assetRef: row.asset_ref,
    isActive: Number(row.is_active) === 1,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
