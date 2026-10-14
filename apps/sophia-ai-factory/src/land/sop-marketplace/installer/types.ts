/**
 * SOP Marketplace Installer Types
 * Layer: LAND (Business Workflow)
 */

import type { Result } from '@/seed/types/result';

export type InstallErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'LISTING_NOT_FOUND'
  | 'LISTING_NOT_PUBLISHED'
  | 'PAYMENT_REQUIRED'
  | 'ALREADY_INSTALLED'
  | 'INSTALL_LIMIT_REACHED'
  | 'DB_ERROR'
  | 'MARKETPLACE_TEMPORARILY_UNAVAILABLE';

export type UninstallErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'INSTALL_NOT_FOUND'
  | 'NOT_OWNER'
  | 'DB_ERROR'
  | 'MARKETPLACE_TEMPORARILY_UNAVAILABLE';

export type InstallResult = Result<
  { licenseId: string },
  { code: InstallErrorCode; message: string }
>;

export type UninstallResult = Result<
  { success: boolean },
  { code: UninstallErrorCode; message: string }
>;
