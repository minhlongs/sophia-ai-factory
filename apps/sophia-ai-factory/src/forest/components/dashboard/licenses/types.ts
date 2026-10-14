export interface License {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  license_key: string;
}

export interface ApiResult {
  licenses: License[];
  total: number;
  page: number;
  limit: number;
}

export type LicenseAction = 'extend' | 'reactivate' | 'regenerate';

export interface LicensesClientProps {
  initialLicenses?: License[];
}
