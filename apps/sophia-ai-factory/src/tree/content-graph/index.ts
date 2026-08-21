/**
 * Content Graph — barrel export
 * @module tree/content-graph
 */

export {
  createProject,
  getProject,
  listProjects,
  updateProjectStatus,
  createAsset,
  getAsset,
  listAssets,
  updateAssetStatus,
  createDerivative,
  getDerivativesOf,
  getContentLineage,
  newProjectId,
  newAssetId,
} from './types';
export type { ContentGraphError } from './types';