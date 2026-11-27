/**
 * Zero-Trust BYOK Keyring Rotation State & Zero-Leak Secret Redactor.
 *
 * Clean-room pure-TS engine (MIT/Apache-2.0 patterns from parthpabari/encryptix,
 * @noem/encryption, and frameprivacy/column-seal):
 * - Fail-closed multi-version KEK lifecycle (`active`, `decrypt_only`, `pending_deletion`)
 *   for zero-downtime D1 batched re-wrapping (`enc_key_version < activeVersion`).
 * - Redacts raw API keys/tokens before logging or telemetry emission.
 *
 * Layer: seed/security (pure deterministic policy, zero Node built-ins)
 *
 * @module seed/security/byok-key-rotation
 */

export type KekLifecycleState = 'active' | 'decrypt_only' | 'pending_deletion';

export interface KekVersionRecord {
  readonly version: number;
  readonly state: KekLifecycleState;
  readonly rowsEncrypted: number;
}

export interface KeyRotationPlan {
  readonly activeVersion: number;
  readonly rowsNeedingRewrap: number;
  readonly safeToRetireVersions: readonly number[];
}

const SECRET_TOKEN_REGEX =
  /\b(?:sk-[a-zA-Z0-9_-]{12,}|sk-or-v1-[a-zA-Z0-9]{16,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g;

export function redactSecretsInText(raw: string): string {
  return raw.replace(SECRET_TOKEN_REGEX, '[REDACTED_SECRET]');
}

export function planZeroDowntimeKekRotation(versions: readonly KekVersionRecord[]): KeyRotationPlan {
  const activeRecords = versions.filter((v) => v.state === 'active');
  if (activeRecords.length !== 1) {
    throw new Error(`Expected exactly 1 active KEK version, found ${activeRecords.length}`);
  }

  const activeVersion = activeRecords[0].version;
  let rowsNeedingRewrap = 0;
  const safeToRetireVersions: number[] = [];

  for (const v of versions) {
    if (!Number.isInteger(v.rowsEncrypted) || v.rowsEncrypted < 0) {
      throw new Error(`Invalid rowsEncrypted for KEK v${v.version}: ${v.rowsEncrypted}`);
    }
    if (v.state === 'active' || v.version === activeVersion) continue;
    if (v.rowsEncrypted > 0) {
      rowsNeedingRewrap += v.rowsEncrypted;
    } else {
      safeToRetireVersions.push(v.version);
    }
  }

  return { activeVersion, rowsNeedingRewrap, safeToRetireVersions };
}
