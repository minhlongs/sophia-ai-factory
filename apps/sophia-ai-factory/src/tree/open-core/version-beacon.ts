/**
 * Privacy-Safe Open-Core Release & Security Advisory Beacon
 *
 * Checks `https://sophia.agencyos.network/api/version` for new upstream releases
 * when running in self-hosted Community mode.
 *
 * Privacy invariant: Sends ZERO customer data, ZERO API keys, and ZERO PII.
 * Can be disabled completely via `SOPHIA_DISABLE_VERSION_BEACON=true`.
 *
 * Layer: tree/open-core
 * @module tree/open-core/version-beacon
 */

import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

const CIRCUIT_PROVIDER_ID = 'sophia-version-beacon';
const DEFAULT_CLOUD_VERSION_URL = 'https://sophia.agencyos.network/api/version';

export interface VersionBeaconCheckOptions {
  readonly localShortSha: string;
  readonly disableBeacon?: boolean;
  readonly versionEndpointUrl?: string;
  readonly timeoutMs?: number;
}

export interface VersionBeaconReport {
  readonly checked: boolean;
  readonly localShortSha: string;
  readonly upstreamShortSha: string | null;
  readonly updateAvailable: boolean;
  readonly cloudUpgradeUrl: string;
}

/**
 * Checks whether a self-hosted instance is behind the official Sophia Cloud release.
 */
export async function checkUpstreamReleaseBeacon(
  options: VersionBeaconCheckOptions,
): Promise<VersionBeaconReport> {
  const localNorm = options.localShortSha.trim().slice(0, 8);
  const disabled =
    options.disableBeacon ??
    process.env.SOPHIA_DISABLE_VERSION_BEACON === 'true';

  if (disabled) {
    return {
      checked: false,
      localShortSha: localNorm,
      upstreamShortSha: null,
      updateAvailable: false,
      cloudUpgradeUrl: 'https://sophia.agencyos.network/pricing',
    };
  }

  if (!shouldAllowRequest(CIRCUIT_PROVIDER_ID)) {
    return {
      checked: false,
      localShortSha: localNorm,
      upstreamShortSha: null,
      updateAvailable: false,
      cloudUpgradeUrl: 'https://sophia.agencyos.network/pricing',
    };
  }

  const endpoint = options.versionEndpointUrl ?? DEFAULT_CLOUD_VERSION_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 2500);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      recordFailure(CIRCUIT_PROVIDER_ID, classifyHttpStatus(res.status));
      return {
        checked: false,
        localShortSha: localNorm,
        upstreamShortSha: null,
        updateAvailable: false,
        cloudUpgradeUrl: 'https://sophia.agencyos.network/pricing',
      };
    }

    const data = (await res.json()) as { shortSha?: string };
    recordSuccess(CIRCUIT_PROVIDER_ID);

    const upstreamNorm = (data.shortSha ?? '').trim().slice(0, 8) || null;
    const updateAvailable = Boolean(
      upstreamNorm &&
      localNorm &&
      upstreamNorm !== 'unknown' &&
      upstreamNorm !== localNorm,
    );

    return {
      checked: true,
      localShortSha: localNorm,
      upstreamShortSha: upstreamNorm,
      updateAvailable,
      cloudUpgradeUrl: 'https://sophia.agencyos.network/pricing',
    };
  } catch (err) {
    clearTimeout(timer);
    recordFailure(CIRCUIT_PROVIDER_ID, classifyError(err));
    return {
      checked: false,
      localShortSha: localNorm,
      upstreamShortSha: null,
      updateAvailable: false,
      cloudUpgradeUrl: 'https://sophia.agencyos.network/pricing',
    };
  }
}
