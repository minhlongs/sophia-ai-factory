/**
 * High-DPI Printable HTML Report CSS Styles
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-styles
 */

import { buildBaseHtmlStyles } from './html-styles-base';
import { buildKpiAndPrintStyles } from './html-styles-kpi';

export function buildPrintableHtmlStyles(primaryColor: string, accentColor: string): string {
  return `${buildBaseHtmlStyles(primaryColor, accentColor)}\n${buildKpiAndPrintStyles()}`;
}
