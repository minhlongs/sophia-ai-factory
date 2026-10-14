import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const SITE_URL = 'https://sophia.agencyos.network';

export interface SchemaSoftwareApplication {
  '@type': 'SoftwareApplication';
  '@id': string;
  name: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  description: string;
  offers: {
    '@type': 'AggregateOffer';
    priceCurrency: string;
    lowPrice: string;
    highPrice: string;
    offerCount: string;
  };
  featureList: string;
  author: {
    '@type': 'Organization';
    name: string;
    url: string;
  };
}

export interface SchemaProduct {
  '@type': 'Product';
  '@id': string;
  name: string;
  description: string;
  brand: {
    '@type': 'Brand';
    name: string;
  };
  offers: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
    availability: string;
    url: string;
  };
}

export interface SchemaFaqQuestion {
  '@type': 'Question';
  name: string;
  acceptedAnswer: {
    '@type': 'Answer';
    text: string;
  };
}

export interface SchemaFaqPage {
  '@type': 'FAQPage';
  '@id': string;
  mainEntity: SchemaFaqQuestion[];
}

export interface SchemaBreadcrumbListItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
}

export interface SchemaBreadcrumbList {
  '@type': 'BreadcrumbList';
  '@id': string;
  itemListElement: SchemaBreadcrumbListItem[];
}

export interface SolutionsMultiEntityGraph {
  '@context': 'https://schema.org';
  '@graph': [
    SchemaSoftwareApplication,
    SchemaProduct,
    SchemaFaqPage,
    SchemaBreadcrumbList,
  ];
}

export interface SolutionsSchemaInput {
  industry: SolutionIndustry;
  locale: 'en' | 'vi';
  baseUrl?: string;
}
