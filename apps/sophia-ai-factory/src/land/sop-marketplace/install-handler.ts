/**
 * SOP Installation Handler
 *
 * Facade module for installing and uninstalling SOPs from the Creator Marketplace.
 * Validates auth, listing status, duplicate installs, tier limits, and records
 * creator commission on successful install.
 *
 * @module land/sop-marketplace/install-handler
 */

export { installSop } from './installer/sop-install';
export { uninstallSop } from './installer/sop-uninstall';
export type {
  InstallErrorCode,
  UninstallErrorCode,
  InstallResult,
  UninstallResult,
} from './installer/types';
