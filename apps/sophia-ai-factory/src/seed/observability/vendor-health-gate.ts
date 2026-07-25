/** Vendor health gate — block workflow-stepper if critical vendors are down */
type VendorHealth = { provider: string; healthy: boolean; checkedAt: number };
const HEALTH_TTL_MS = 30_000;
const vendorState = new Map<string, VendorHealth>();

export function markVendorHealthy(provider: string): void {
  vendorState.set(provider, { provider, healthy: true, checkedAt: Date.now() });
}

export function markVendorDown(provider: string): void {
  vendorState.set(provider, { provider, healthy: false, checkedAt: Date.now() });
}

export function isVendorHealthy(provider: string): boolean {
  const entry = vendorState.get(provider);
  if (!entry) return true;
  if (Date.now() - entry.checkedAt > HEALTH_TTL_MS) {
    vendorState.delete(provider);
    return true;
  }
  return entry.healthy;
}

export function refreshVendorHealth(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  const now = Date.now();
  for (const [provider, entry] of vendorState.entries()) {
    const fresh = now - entry.checkedAt <= HEALTH_TTL_MS;
    result[provider] = fresh ? entry.healthy : true;
    if (!fresh) vendorState.delete(provider);
  }
  return result;
}
