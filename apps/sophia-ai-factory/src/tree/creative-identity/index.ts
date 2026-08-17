/**
 * Creative Identity — barrel export
 * @module tree/creative-identity
 */

export {
  getActiveIdentity,
  getIdentity,
  listIdentityVersions,
  createIdentity,
  updateIdentity,
  deactivateIdentity,
  newIdentityId,
} from './types';
export type { CreativeIdentityRow, CreativeIdentityError } from './types';