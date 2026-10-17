/** Synthetic payment and fulfillment routes are only valid in non-production environments. */
export function isSyntheticTestingEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
}
