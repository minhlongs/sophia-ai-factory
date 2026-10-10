/**
 * Edge Mesh Localization Types and Contracts
 *
 * Layer: tree/localization/mesh
 */

export interface EdgeRequestHeaders {
  ipCountry?: string | null;
  cfRay?: string | null;
  cfRegion?: string | null;
  acceptLanguage?: string | null;
  cookie?: string | null;
  pathname?: string | null;
}

export interface EdgeKvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface ParsedLanguageWeight {
  locale: string;
  primaryCode: string;
  q: number;
}
