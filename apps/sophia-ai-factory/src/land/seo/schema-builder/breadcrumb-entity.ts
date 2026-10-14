import type { SolutionIndustry } from '@/seed/types/solutions-types';
import type { SchemaBreadcrumbList } from './types';

/**
 * Builds the BreadcrumbList entity schema for a specific industry solution.
 */
export function buildBreadcrumbListEntity(
  industry: SolutionIndustry,
  locale: 'en' | 'vi',
  baseUrl: string,
  canonicalUrl: string,
): SchemaBreadcrumbList {
  const isVi = locale === 'vi';
  const homeLabel = isVi ? 'Trang chủ' : 'Home';
  const solutionsLabel = isVi ? 'Giải pháp' : 'Solutions';
  const industryLabel = isVi ? industry.nameVi : industry.nameEn;

  const homeUrl = `${baseUrl}/${locale}`;
  const solutionsUrl = `${baseUrl}/${locale}/solutions`;

  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: homeLabel,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: solutionsLabel,
        item: solutionsUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: industryLabel,
        item: canonicalUrl,
      },
    ],
  };
}
