/**
 * OpenAPI Path Endpoint Specifications
 *
 * Layer: seed/openapi
 */

import { MISSION_PATHS } from './paths-missions';
import { CATALOG_PATHS } from './paths-catalog';

export const OPENAPI_PATHS: Record<string, Record<string, unknown>> = {
  ...MISSION_PATHS,
  ...CATALOG_PATHS,
};
