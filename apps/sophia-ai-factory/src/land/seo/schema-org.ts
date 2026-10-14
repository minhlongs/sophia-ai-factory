/**
 * Schema.org JSON-LD builders for Sophia AI Factory.
 * Each builder returns a plain object — callers inject via <script type="application/ld+json">.
 *
 * Usage:
 *   const schema = buildOrganizationSchema();
 *   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
 */

export {
  buildOrganizationSchema,
  buildFAQPageSchema,
  buildBreadcrumbSchema,
  BREADCRUMBS,
} from './schema-org-content';
export type {
  FaqSchemaItem,
  BreadcrumbSchemaItem,
  OrganizationSchema,
  FaqPageSchema,
  BreadcrumbListSchema,
} from './schema-org-content';
export { buildProductSchema, buildAllProductSchemas } from './schema-org-product';
export type { ProductSchema } from './schema-org-product';
