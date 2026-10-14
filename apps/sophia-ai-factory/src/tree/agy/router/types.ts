export type HostnameClassificationType =
  | 'canonical'
  | 'reserved_subdomain'
  | 'agency_subdomain'
  | 'custom_domain'
  | 'localhost';

export interface HostnameClassification {
  type: HostnameClassificationType;
  slug: string | null;
  normalized: string;
}

export interface ParsedHostnameMetadata {
  normalized: string;
  isAgencySubdomain: boolean;
  agencySlug: string | null;
  isReserved: boolean;
  isCustomDomain: boolean;
  isCanonical: boolean;
}
