/**
 * OpenAPI Specification Assembler & Exports
 *
 * Layer: seed/openapi
 */

import { OPENAPI_INFO, OPENAPI_SERVERS } from './info';
import { OPENAPI_COMPONENTS } from './components';
import { OPENAPI_PATHS } from './paths';
import type { OpenApiSpec } from './types';

export * from './types';
export * from './info';
export * from './components';
export * from './paths';

export const OPENAPI_SPEC: OpenApiSpec = {
  openapi: '3.1.0',
  info: OPENAPI_INFO,
  servers: [...OPENAPI_SERVERS],
  paths: OPENAPI_PATHS,
  components: OPENAPI_COMPONENTS,
};
