export interface ApiKeyAuthResult {
  valid: boolean;
  userId?: string;
  licenseNonce?: string;
  tier?: string;
  error?: string;
}
