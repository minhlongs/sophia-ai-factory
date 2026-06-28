/**
 * SOP Repository — barrel re-export
 *
 * Aggregates template, installation, and run sub-repos into single import surface.
 * Split for ≤200 LOC rule: each sub-module handles one table domain.
 */

export {
  listOfficialTemplates,
  getTemplateBySlug,
  getTemplateById,
  getTemplatesByIds,
  listMarketplaceTemplates,
  listTemplatesByAuthor,
  createTemplate,
} from './sop-repo-templates';

export {
  getListingByTemplateId,
  listPublishedListings,
  createListing,
  updateListingStatus,
  incrementSales,
  createLicense,
  markLicensePaid,
  getUserLicense,
  listUserLicenses,
  listCreatorSales,
} from './sop-repo-marketplace';

export {
  listInstallationsForUser,
  getInstallation,
  createInstallation,
  updateCustomizations,
  setEnabled,
  advanceSchedule,
  deleteInstallation,
  claimDueInstallations,
  updateConfigValues,
} from './sop-repo-installations';

export {
  createRun,
  updateRunStatus,
  appendMissionId,
} from './sop-repo-runs';
