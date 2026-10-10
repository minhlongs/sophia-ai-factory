export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function resetOpenRouterCircuit(): void {
  // Canonical circuit breaker manages state via D1 persistence; no local reset needed
}

export function getOpenRouterCircuitState(): { openUntil: number; failures: number } {
  // Canonical circuit breaker doesn't expose internal state; return safe defaults
  return { openUntil: 0, failures: 0 }
}
