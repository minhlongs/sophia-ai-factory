/**
 * Cloudflare Custom Hostnames & White-Label Branding type definitions.
 *
 * Layer: seed (Foundational primitives)
 */

export interface CloudflareSslValidationRecord {
  status?: string;
  txt_name?: string;
  txt_value?: string;
  http_url?: string;
  http_body?: string;
  cname_name?: string;
  cname_target?: string;
}

export interface CloudflareCustomHostnameResult {
  id: string;
  hostname: string;
  status: 'pending' | 'active' | 'blocked' | 'moved';
  verification_errors?: string[];
  ownership_verification?: {
    type: 'txt';
    name: string;
    value: string;
  };
  ssl: {
    id?: string;
    type?: string;
    method?: 'txt' | 'http' | 'cname';
    status: 'pending_validation' | 'pending_deployment' | 'active' | 'error' | 'timed_out' | 'revoked';
    txt_name?: string;
    txt_value?: string;
    validation_records?: CloudflareSslValidationRecord[];
    settings?: {
      min_tls_version?: string;
      http2?: string;
    };
  };
}

export interface CloudflareApiResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T;
}

export interface WhiteLabelBrandingSettings {
  orgId: string;
  agencyName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  pageTitle: string | null;
  footerText: string | null;
  welcomeMessage: string | null;
}

export interface SaveWhiteLabelBrandingInput {
  agencyName?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  pageTitle?: string | null;
  footerText?: string | null;
  welcomeMessage?: string | null;
}

export interface WhiteLabelActionError {
  code: string;
  message: string;
}
