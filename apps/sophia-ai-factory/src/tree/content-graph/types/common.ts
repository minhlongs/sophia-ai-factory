export {
  type ProjectRow,
  type AssetRow,
  type DerivativeRow,
  projectRowToDomain,
  assetRowToDomain,
  derivativeRowToDomain,
} from './row-mappers';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ContentGraphError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ContentGraphError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function newProjectId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'prj_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newAssetId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'ast_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
