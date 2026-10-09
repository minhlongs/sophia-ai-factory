/**
 * Financial Close & Withholding Tax Constants
 * Layer: tree/finance
 *
 * @module tree/finance/close/constants
 */

import type { WithholdingTaxRegime } from '@/seed/types/financial-close';

export const WITHHOLDING_TAX_RATES: Record<WithholdingTaxRegime, number> = {
  VN_FCT_10PCT: 10.0,
  VN_FCT_5PCT: 5.0,
  US_W8_30PCT: 30.0,
  US_W8_TREATY_0PCT: 0.0,
  SG_DTA_EXEMPT: 0.0,
  NONE: 0.0,
};
