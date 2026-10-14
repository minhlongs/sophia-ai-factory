import { SITE_URL, SolutionsSchemaInput, SolutionsMultiEntityGraph } from './types';
import { buildSoftwareApplicationEntity } from './software-app-entity';
import { buildProductEntity } from './product-entity';
import { buildFaqPageEntity } from './faq-page-entity';
import { buildBreadcrumbListEntity } from './breadcrumb-entity';

/**
 * Builds the composite multi-entity JSON-LD graph combining:
 * SoftwareApplication + Product + FAQPage + BreadcrumbList.
 */
export function buildSolutionsMultiEntitySchema(input: SolutionsSchemaInput): SolutionsMultiEntityGraph {
  const baseUrl = input.baseUrl || SITE_URL;
  const canonicalUrl = `${baseUrl}/${input.locale}/solutions/${input.industry.slug}`;

  const softwareApp = buildSoftwareApplicationEntity(baseUrl);
  const product = buildProductEntity(input.industry, input.locale, canonicalUrl);
  const faqPage = buildFaqPageEntity(input.industry, input.locale, canonicalUrl);
  const breadcrumbList = buildBreadcrumbListEntity(input.industry, input.locale, baseUrl, canonicalUrl);

  return {
    '@context': 'https://schema.org',
    '@graph': [softwareApp, product, faqPage, breadcrumbList],
  };
}
