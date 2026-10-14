/**
 * Template Activation Types
 *
 * Layer: tree/creator-royalties/template-activation
 */

export interface TemplateRow {
  id: string;
  creator_id: string;
  price_cents: number;
  royalty_pct: number;
  status: string;
}
